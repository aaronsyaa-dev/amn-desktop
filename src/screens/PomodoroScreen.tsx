import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide, useHaloSignal } from '../components/EtatEcran';
import { useSync, uid } from '../state/SyncContext';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Seance {
  startedAt: string;
  minutes: number;
  label: string;
}
type Phase = 'travail' | 'pause' | 'pauseLongue';
const DUREES = [15, 25, 50];
const PAUSE_MIN = 5;
/** La pause longue, au bout de quatre séances — c'est ce qui fait un CYCLE. */
const PAUSE_LONGUE_MIN = 15;
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/*
  ═════════════════════════════════════════════════════════════════════
  LE CADRAN — soixante crans, et pourquoi ce n'est pas un ornement
  ═════════════════════════════════════════════════════════════════════

  Les soixante crans donnent L'ÉCHELLE DE LA MINUTE. Sans eux, un arc de
  progression ne dit que « à peu près la moitié » ; avec eux, on compte les
  crans restants et on sait qu'il reste sept minutes sans lire le chiffre. Ce
  sont eux qui font de ce disque un cadran plutôt qu'une barre enroulée.

  LEUR GÉOMÉTRIE EST DÉDUITE, PAS TAPÉE. La circonférence du cercle de rayon
  `CADRAN_R` vaut 2πr ; divisée par soixante, elle donne la période d'un cran.
  Le trait occupe `CRAN_L` de cette période, le vide le reste. Écrire les deux
  nombres en dur — c'est ce que faisait la maquette, avec « 1,6 / 13,27 » —
  donnerait soixante crans pour CE rayon-là et cinquante-huit pour un autre,
  sans que personne le voie.

  C'est la seule composition CENTRÉE ET SYMÉTRIQUE du produit. Tout le reste
  est aligné à gauche ; ici, l'objet est un objet, et il se regarde de face.
*/
const CADRAN_PX = 300;
const CADRAN_R = 142;
const CRAN_L = 1.6;
const ARC_EPAISSEUR = 11;
const CIRCONFERENCE = 2 * Math.PI * CADRAN_R;
const PERIODE_CRAN = CIRCONFERENCE / 60;

/** Le cycle de quatre : deux pleines, une en cours, une en filet. */
const CYCLE = 4;
const PASTILLE_PX = 52;
/** Une brique par séance terminée, empilée par le bas. */
const BRIQUE_H = 15;

/**
 * LE POMODORO — vingt-cinq minutes, puis une pause.
 *
 * Pour qui : quelqu'un qui n'arrive pas à s'y mettre. Ce que ça règle : un
 * minuteur qui ne fait qu'une chose, et qui, à la fin d'une séance, pose une
 * vraie ligne dans Temps — le même enregistrement qu'un chronomètre lancé
 * là-bas. Le compte des séances est personnel et reste sur ce poste ; le
 * temps, lui, est celui de l'organisation, parce qu'il l'est vraiment.
 *
 * ## Ce qui domine : le cadran
 *
 * L'écran avait un gros chiffre et une barre de progression de 1 px. La barre
 * était le problème : un minuteur n'est pas une tâche qui avance, c'est un
 * TEMPS QUI TOURNE, et rien ne dit cela comme un cadran. Voir l'en-tête des
 * constantes pour les soixante crans, qui en sont la moitié du sens.
 *
 * ## L'ambre : l'arc, et rien d'autre
 *
 * Un seul nœud. LA PASTILLE DU CYCLE EN COURS RESTE EN ENCRE CLAIRE — c'est
 * la tentation évidente et ce serait la faute : deux ambres, donc aucun. Ce
 * qui demande l'attention est le temps qui reste, pas la place dans le cycle.
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
  /* La place dans le cycle de quatre. Une séance ABANDONNÉE ne compte pas :
     `remettre` la ramène à zéro, et le cycle reprend à la première. */
  const [rang, setRang] = useState(0);
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
      const suivant = rang + 1;
      setRang(suivant % CYCLE);
      /* Au bout de quatre séances, la pause est longue. C'est ce qui fait du
         compte de quatre un cycle plutôt qu'une décoration. */
      const longue = suivant >= CYCLE;
      setPhase(longue ? 'pauseLongue' : 'pause');
      setRestant((longue ? PAUSE_LONGUE_MIN : PAUSE_MIN) * 60);
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
    setRang(0);
    debut.current = null;
  };
  const choisir = (d: number) => {
    setDuree(d);
    setEnCours(false);
    setPhase('travail');
    setRestant(d * 60);
    setRang(0);
    debut.current = null;
  };

  const mm = String(Math.floor(restant / 60)).padStart(2, '0');
  const ss = String(restant % 60).padStart(2, '0');
  const total = phase === 'travail' ? duree * 60 : (phase === 'pauseLongue' ? PAUSE_LONGUE_MIN : PAUSE_MIN) * 60;
  const part = total > 0 ? (total - restant) / total : 0;
  const halo = useHaloSignal(enCours);

  /* LA SEMAINE EN BRIQUES — une colonne par jour, empilée par le bas. */
  const semaine = useMemo(() => {
    const d = new Date();
    const lundi = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, i) => {
      const jour = isoJour(new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + i));
      return { jour, n: seances.filter((s) => s.startedAt.slice(0, 10) === jour).length };
    });
  }, [seances]);
  const briquesMax = Math.max(1, ...semaine.map((s) => s.n));

  const vide = pret && seances.length === 0 && !enCours;
  const duJourInverse = [...duJour].reverse();

  return (
    <EcranVide quand={Boolean(vide)} premierJour={Boolean(vide)}>
      <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
        <motion.div variants={staggerItem}>
          <ScreenHeader
            eyebrow={t('perso.surtitre', { module: t('pomodoro.titre') })}
            title={t('pomodoro.titre')}
            description={t('pomodoro.description')}
            phraseVide={t('pomodoro.vide.phrase')}
            stats={[
              { label: t('pomodoro.stat.seances'), value: duJour.length },
              { label: t('pomodoro.stat.minutes'), value: minutesDuJour },
              { label: t('pomodoro.stat.total'), value: seances.length },
            ]}
          />
        </motion.div>

        {/* ═══ L'OBJET DOMINANT : le cadran, centré et symétrique ═══ */}
        <motion.section variants={staggerItem} aria-live="polite" className="panel-raised flex flex-col items-center p-6 sm:p-8">
          <p className="eyebrow mb-5">
            {phase === 'travail' ? t('pomodoro.phase.travail') : phase === 'pauseLongue' ? t('pomodoro.phase.pauseLongue') : t('pomodoro.phase.pause')}
          </p>

          <div className="relative" style={{ width: CADRAN_PX, height: CADRAN_PX }}>
            <svg viewBox={`0 0 ${CADRAN_PX} ${CADRAN_PX}`} className={`h-full w-full ${halo}`} aria-hidden>
              {/*
                LES SOIXANTE CRANS. La période vient du rayon, le trait fait
                `CRAN_L` de cette période — voir l'en-tête. Rien n'est écrit en
                dur, donc changer le rayon garde soixante crans.
              */}
              <circle
                cx={CADRAN_PX / 2}
                cy={CADRAN_PX / 2}
                r={CADRAN_R}
                fill="none"
                stroke="var(--color-border-strong)"
                strokeWidth={7}
                strokeDasharray={`${CRAN_L} ${PERIODE_CRAN - CRAN_L}`}
              />
              {/* L'ARC DE PROGRESSION — l'unique ambre de l'écran. */}
              <circle
                data-signal-groupe="arc"
                cx={CADRAN_PX / 2}
                cy={CADRAN_PX / 2}
                r={CADRAN_R - ARC_EPAISSEUR}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth={ARC_EPAISSEUR}
                strokeLinecap="butt"
                strokeDasharray={CIRCONFERENCE}
                strokeDashoffset={CIRCONFERENCE * (1 - part)}
                transform={`rotate(-90 ${CADRAN_PX / 2} ${CADRAN_PX / 2})`}
                className="transition-[stroke-dashoffset] duration-1000 ease-linear motion-reduce:transition-none"
              />
            </svg>
            {/* LE TEMPS, au centre, en 62 px mono. */}
            <p
              role="timer"
              aria-label={`${mm}:${ss}`}
              className="absolute inset-0 flex items-center justify-center font-mono text-[62px] font-medium leading-none tabular-nums text-text-primary"
            >
              {mm}:{ss}
            </p>
          </div>

          {/* LE CYCLE DE QUATRE. La pastille en cours reste en ENCRE CLAIRE. */}
          <ul className="mt-7 flex items-center gap-3" aria-label={t('pomodoro.cycle')}>
            {Array.from({ length: CYCLE }, (_, i) => {
              const faite = i < rang;
              const enTrain = i === rang;
              return (
                <li
                  key={i}
                  className="relative overflow-hidden"
                  style={{ width: PASTILLE_PX, height: PASTILLE_PX }}
                  aria-label={faite ? t('pomodoro.faite') : enTrain ? t('pomodoro.enCours') : t('pomodoro.aVenir')}
                >
                  <span
                    className={`absolute inset-0 ${faite ? 'bg-text-body' : 'border border-border-strong'}`}
                    aria-hidden
                  />
                  {/* En cours : partiellement remplie, par le bas, en encre claire. */}
                  {enTrain && phase === 'travail' && (
                    <span
                      className="absolute inset-x-0 bottom-0 bg-text-body transition-[height] duration-1000 ease-linear motion-reduce:transition-none"
                      style={{ height: `${part * 100}%` }}
                      aria-hidden
                    />
                  )}
                </li>
              );
            })}
          </ul>

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('pomodoro.champ')}
            aria-label={t('pomodoro.champ')}
            className="input-focus mt-7 min-h-11 w-full max-w-md border border-border bg-bg px-3 text-center text-sm text-text-primary outline-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {enCours ? (
              <button type="button" onClick={() => setEnCours(false)} className="flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover"><Pause size={14} /> {t('pomodoro.pause')}</button>
            ) : (
              <button type="button" onClick={lancer} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-hover"><Play size={14} /> {restant === total ? t('pomodoro.lancer') : t('pomodoro.reprendre')}</button>
            )}
            <button type="button" onClick={remettre} className="flex min-h-11 items-center gap-2 border border-border px-4 text-sm text-text-secondary hover:text-text-primary"><RotateCcw size={14} /> {t('pomodoro.remettre')}</button>
          </div>
          <div role="radiogroup" aria-label={t('pomodoro.duree')} className="mt-3 flex gap-1">
            {DUREES.map((d) => (
              <button key={d} type="button" role="radio" aria-checked={duree === d} onClick={() => choisir(d)} className={`min-h-11 border px-3 font-mono text-xs tabular-nums ${duree === d ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>{t('pomodoro.minutes', { n: d })}</button>
            ))}
          </div>
          <p className="mt-3 max-w-prose text-center text-xs leading-relaxed text-text-muted">{t('pomodoro.abandonNonCompte')}</p>
        </motion.section>

        {vide ? (
          <motion.div variants={staggerItem}>
            <FirstRun title={t('pomodoro.vide.titre')}>{t('pomodoro.vide.texte')}</FirstRun>
          </motion.div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* À GAUCHE — la semaine en briques, empilée par le bas. */}
            <motion.section variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-4">{t('pomodoro.laSemaine')}</p>
              <div className="flex items-end gap-3" style={{ height: briquesMax * (BRIQUE_H + 3) + 24 }}>
                {semaine.map((jour) => (
                  <div key={jour.jour} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    {/* `flex-col-reverse` : la première brique se rend EN BAS,
                        et la pile monte — comme on empile vraiment. */}
                    <span className="flex w-full flex-col-reverse gap-[3px]" aria-hidden>
                      {Array.from({ length: jour.n }, (_, i) => (
                        <span key={i} className="w-full bg-border-strong" style={{ height: BRIQUE_H }} />
                      ))}
                    </span>
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-text-muted">
                      {new Date(`${jour.jour}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              {duJourInverse.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3">
                  {duJourInverse.slice(0, 5).map((s) => (
                    <li key={s.startedAt} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-text-secondary">{s.label}</span>
                      <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {t('pomodoro.minutes', { n: s.minutes })} · {new Date(s.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.section>

            {/* À DROITE — les trois durées du cycle, en barres proportionnelles. */}
            <motion.aside variants={staggerItem} className="panel p-4">
              <p className="eyebrow mb-3">{t('pomodoro.lesTroisDurees')}</p>
              <ul className="flex flex-col gap-3">
                {[
                  { cle: 'seance', libelle: t('pomodoro.dureeSeance'), minutes: duree },
                  { cle: 'pause', libelle: t('pomodoro.dureePause'), minutes: PAUSE_MIN },
                  { cle: 'longue', libelle: t('pomodoro.dureePauseLongue'), minutes: PAUSE_LONGUE_MIN },
                ].map((d) => (
                  <li key={d.cle} className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-text-secondary">{d.libelle}</span>
                      <span className="font-mono text-[12px] tabular-nums text-text-primary">{t('pomodoro.minutes', { n: d.minutes })}</span>
                    </span>
                    <span className="h-2.5 w-full bg-sunken" aria-hidden>
                      <span className="block h-full bg-border-strong" style={{ width: `${(d.minutes / Math.max(duree, PAUSE_LONGUE_MIN)) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">{t('pomodoro.temps')}</p>
            </motion.aside>
          </div>
        )}
      </motion.section>
    </EcranVide>
  );
}
