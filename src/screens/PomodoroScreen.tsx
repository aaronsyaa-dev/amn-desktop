import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, uid } from '../state/SyncContext';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Seance {
  startedAt: string;
  minutes: number;
  label: string;
}
type Phase = 'travail' | 'pause';
const DUREES = [15, 25, 50];
const PAUSE_MIN = 5;
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * LE POMODORO — 25 minutes, puis une pause, et le temps compté.
 *
 * Pour qui : quelqu'un qui n'arrive pas à s'y mettre. Ce que ça règle : un
 * minuteur qui ne fait qu'une chose, et qui, à la fin d'une séance, pose une
 * vraie ligne dans Temps — le même enregistrement qu'un chronomètre lancé
 * là-bas, facturable, rattachable à un projet. Le compte des séances est
 * personnel et reste sur ce poste ; le temps, lui, est celui de
 * l'organisation, parce qu'il l'est vraiment.
 */
export function PomodoroScreen() {
  const { t } = useLangue();
  const { upsert } = useSync();
  const [seances, setSeances, pret] = usePersonalStore<Seance[]>('pomodoro', []);
  const [duree, setDuree] = useState(25);
  const [label, setLabel] = useState('');
  const [phase, setPhase] = useState<Phase>('travail');
  const [restant, setRestant] = useState(25 * 60);
  const [enCours, setEnCours] = useState(false);
  const debut = useRef<string | null>(null);
  const aujourdhui = isoJour(new Date());
  const duJour = useMemo(() => seances.filter((s) => s.startedAt.slice(0, 10) === aujourdhui), [seances, aujourdhui]);
  const minutesDuJour = duJour.reduce((n, s) => n + s.minutes, 0);

  useEffect(() => {
    if (!enCours) return undefined;
    const id = window.setInterval(() => setRestant((r) => Math.max(0, r - 1)), 1000);
    return () => window.clearInterval(id);
  }, [enCours]);

  useEffect(() => {
    if (!enCours || restant > 0) return;
    setEnCours(false);
    if (phase === 'travail') {
      const startedAt = debut.current ?? new Date(Date.now() - duree * 60_000).toISOString();
      const endedAt = new Date().toISOString();
      const libelle = label.trim() || t('pomodoro.libelleDefaut');
      void upsert('timeEntries', uid('time'), { label: libelle, startedAt, endedAt, invoicedAt: '', createdAt: endedAt });
      setSeances((s) => [...s, { startedAt, minutes: duree, label: libelle }]);
      setPhase('pause');
      setRestant(PAUSE_MIN * 60);
    } else {
      setPhase('travail');
      setRestant(duree * 60);
    }
    debut.current = null;
  }, [restant, enCours]); // eslint-disable-line react-hooks/exhaustive-deps

  const lancer = () => {
    if (phase === 'travail' && !debut.current) debut.current = new Date(Date.now() - (duree * 60 - restant) * 1000).toISOString();
    setEnCours(true);
  };
  const remettre = () => {
    setEnCours(false);
    setPhase('travail');
    setRestant(duree * 60);
    debut.current = null;
  };
  const choisir = (d: number) => {
    setDuree(d);
    setEnCours(false);
    setPhase('travail');
    setRestant(d * 60);
    debut.current = null;
  };
  const mm = String(Math.floor(restant / 60)).padStart(2, '0');
  const ss = String(restant % 60).padStart(2, '0');
  const total = phase === 'travail' ? duree * 60 : PAUSE_MIN * 60;
  const pct = Math.round(((total - restant) / total) * 100);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('perso.surtitre', { module: t('pomodoro.titre') })}
          title={t('pomodoro.titre')}
          description={t('pomodoro.description')}
          stats={[
            { label: t('pomodoro.stat.seances'), value: duJour.length },
            { label: t('pomodoro.stat.minutes'), value: minutesDuJour },
            { label: t('pomodoro.stat.total'), value: seances.length },
          ]}
        />
      </motion.div>

      <motion.section variants={staggerItem} aria-live="polite" className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6">
        <p className="eyebrow">{phase === 'travail' ? t('pomodoro.phase.travail') : t('pomodoro.phase.pause')}</p>
        <p className="tnum font-mono text-6xl font-medium text-text-primary" role="timer" aria-label={`${mm}:${ss}`}>{mm}:{ss}</p>
        <div className="h-1 w-full max-w-md overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('pomodoro.titre')}>
          <div className={`h-full ${phase === 'pause' ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
        </div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('pomodoro.champ')} aria-label={t('pomodoro.champ')} className="input-focus min-h-11 w-full max-w-md border border-border bg-bg px-3 text-center text-sm text-text-primary outline-none" />
        <div className="flex flex-wrap items-center justify-center gap-2">
          {enCours ? (
            <button type="button" onClick={() => setEnCours(false)} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover"><Pause size={14} /> {t('pomodoro.pause')}</button>
          ) : (
            <button type="button" onClick={lancer} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-hover"><Play size={14} /> {restant === total ? t('pomodoro.lancer') : t('pomodoro.reprendre')}</button>
          )}
          <button type="button" onClick={remettre} className="flex min-h-11 items-center gap-2 border border-border px-4 text-sm text-text-secondary hover:text-text-primary"><RotateCcw size={14} /> {t('pomodoro.remettre')}</button>
        </div>
        <div role="radiogroup" aria-label={t('pomodoro.duree')} className="flex gap-1">
          {DUREES.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={duree === d} onClick={() => choisir(d)} className={`tnum min-h-11 border px-3 text-xs ${duree === d ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{t('pomodoro.minutes', { n: d })}</button>
          ))}
        </div>
        <p className="text-xs text-text-muted">{t('pomodoro.temps')}</p>
      </motion.section>

      {pret && seances.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('pomodoro.vide.titre')}>{t('pomodoro.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        duJour.length > 0 && (
          <motion.ul variants={staggerItem} className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface px-4">
            {[...duJour].reverse().map((s) => (
              <li key={s.startedAt} className="flex items-center gap-3 py-2 text-sm">
                <Timer size={13} className="shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1 truncate text-text-primary">{s.label}</span>
                <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('pomodoro.minutes', { n: s.minutes })} · {new Date(s.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              </li>
            ))}
          </motion.ul>
        )
      )}
    </motion.section>
  );
}
