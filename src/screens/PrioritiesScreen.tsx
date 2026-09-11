import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Circle, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Priorite {
  id: string;
  label: string;
  doneAt: string | null;
}
interface DayData {
  email: string;
  day: string;
  items: Priorite[];
  updatedAt: string;
}
const MAX = 3;
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const slug = (email: string) => email.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * LES PRIORITÉS DU JOUR — trois choses, pas dix.
 *
 * Pour qui : quelqu'un dont la liste de tâches ne se termine jamais. Ce que
 * ça règle : trois priorités le matin, cochées ou reportées le soir, et le
 * compte des journées tenues. Les Tâches gardent tout ; ici on ne garde que
 * ce qui compte aujourd'hui, et c'est personnel — chaque membre a les siennes.
 */
export function PrioritiesScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<DayData>('dailyPriorities');
  const [label, setLabel] = useState('');
  const moi = user?.email ?? '';
  const aujourdhui = isoJour(new Date());
  const idDuJour = (day: string) => `prio-${slug(moi)}-${day}`;

  const miens = useMemo(() => brutes.filter((d) => d.email === moi), [brutes, moi]);
  const jour = miens.find((d) => d.day === aujourdhui) ?? null;
  const items = useMemo(() => jour?.items ?? [], [jour]);
  const faites = items.filter((i) => i.doneAt).length;
  const ratioDuJour = `${faites}/${items.length}`;
  const trenteJours = useMemo(() => {
    const depuis = isoJour(new Date(Date.now() - 30 * 86_400_000));
    return miens.filter((d) => d.day >= depuis && d.day <= aujourdhui && d.items.length > 0);
  }, [miens, aujourdhui]);
  const tenues = trenteJours.filter((d) => d.items.every((i) => i.doneAt)).length;
  const serie = useMemo(() => {
    let n = 0;
    for (let k = 1; k <= 60; k += 1) {
      const day = isoJour(new Date(Date.now() - k * 86_400_000));
      const d = miens.find((x) => x.day === day);
      if (!d || d.items.length === 0 || !d.items.every((i) => i.doneAt)) break;
      n += 1;
    }
    return n + (items.length > 0 && items.every((i) => i.doneAt) ? 1 : 0);
  }, [miens, items]);

  const enregistrer = (day: string, nouveaux: Priorite[]) =>
    upsert('dailyPriorities', idDuJour(day), { email: moi, day, items: nouveaux, updatedAt: new Date().toISOString() });
  const poser = async () => {
    if (!label.trim() || items.length >= MAX) return;
    await enregistrer(aujourdhui, [...items, { id: uid('pri'), label: label.trim(), doneAt: null }]);
    setLabel('');
  };
  const basculer = (p: Priorite) => enregistrer(aujourdhui, items.map((i) => (i.id === p.id ? { ...i, doneAt: i.doneAt ? null : new Date().toISOString() } : i)));
  const retirer = (p: Priorite) => enregistrer(aujourdhui, items.filter((i) => i.id !== p.id));
  const reporter = async (p: Priorite) => {
    const demain = isoJour(new Date(Date.now() + 86_400_000));
    const existants = miens.find((d) => d.day === demain)?.items ?? [];
    if (existants.length >= MAX) return;
    await enregistrer(demain, [...existants, { ...p, doneAt: null }]);
    await retirer(p);
  };

  /*
    LES TRENTE DERNIERS JOURS, un carré par jour. Une journée TENUE est une
    journée où les trois cases ont été cochées — pas « au moins une », sinon la
    bande dirait qu'on tient une discipline qu'on ne tient pas.
  */
  const bande = useMemo(
    () =>
      Array.from({ length: 30 }, (_, k) => {
        const day = isoJour(new Date(Date.now() - (29 - k) * 86_400_000));
        const d = miens.find((x) => x.day === day);
        const pose = Boolean(d && d.items.length > 0);
        return {
          day,
          pose,
          tenue: Boolean(pose && d?.items.every((i) => i.doneAt)),
          aujourdhui: day === aujourdhui,
        };
      }),
    [miens, aujourdhui],
  );
  const debutBande = bande[0]?.day ?? aujourdhui;
  /** Les trois emplacements, occupés ou non — c'est la forme de l'écran. */
  const places = [0, 1, 2].map((i) => items[i] ?? null);
  const libre = items.length < MAX;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-7">
      <motion.div variants={staggerItem}>
        {/*
          LE TITRE EST LA RÈGLE, pas le nom du module (5c). « Priorités du
          jour » est dans la barre latérale et dans le surtitre ; le répéter en
          32 px n'apprend rien. « Trois choses, pas dix » dit ce que l'écran
          impose — et c'est la seule chose qu'il faut comprendre pour s'en
          servir. Le sous-titre compte ce qui reste, sur les vraies données.
        */}
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('priorites.titre') })}
          title={t('priorites.principe')}
          description={
            items.length === 0
              ? t('priorites.description')
              : t('priorites.etatDuJour', { faites, restantes: MAX - items.length })
          }
          stats={[
            { label: t('priorites.stat.aujourdhui'), value: ratioDuJour, emphasis: items.length > 0 && faites === items.length },
            { label: t('priorites.stat.journeesTenues'), value: tenues },
            { label: t('priorites.stat.serie'), value: serie },
          ]}
        />
      </motion.div>

      {/* ── Les trois emplacements ──────────────────────────────────────── */}
      <motion.div variants={staggerItem} className="grid gap-4 md:grid-cols-3">
        {places.map((p, i) => {
          if (!p) {
            const premierLibre = items.length === i;
            return (
              <div
                key={`libre-${i}`}
                className="flex min-h-[190px] flex-col gap-3 border border-dashed border-border p-5"
              >
                <p className="tnum font-mono text-[12.5px] text-text-muted">0{i + 1}</p>
                <p className="text-[15px] text-text-secondary">{t('priorites.emplacementLibre')}</p>
                {premierLibre && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void poser();
                    }}
                    className="mt-auto flex flex-col gap-2"
                  >
                    <input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder={t('priorites.champ')}
                      aria-label={t('priorites.champ')}
                      className="min-h-11 w-full border border-border bg-sunken px-3 text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-signal focus:bg-[#0b0b0b]"
                    />
                    <p className="eyebrow text-text-muted">{t('priorites.troisMaximum')}</p>
                  </form>
                )}
              </div>
            );
          }
          const faite = Boolean(p.doneAt);
          /* La carte DOMINANTE est celle qu'on doit faire maintenant : la
             première non cochée. Les faites s'effacent, les suivantes attendent. */
          const courante = !faite && items.findIndex((x) => !x.doneAt) === i;
          return (
            <div
              key={p.id}
              className={`group flex min-h-[190px] flex-col gap-3 p-5 ${courante ? 'panel-raised' : 'panel'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="tnum font-mono text-[12.5px] text-text-muted">0{i + 1}</p>
                <button
                  type="button"
                  onClick={() => void basculer(p)}
                  aria-pressed={faite}
                  aria-label={t('priorites.cocher')}
                  className="-m-2 p-2 text-text-muted transition-colors hover:text-text-primary"
                >
                  {faite ? (
                    <Check size={17} strokeWidth={2.1} className="text-text-primary" />
                  ) : (
                    <Circle size={17} strokeWidth={1.9} />
                  )}
                </button>
              </div>
              <p
                className={`text-[18px] font-semibold leading-[1.3] ${
                  faite ? 'text-text-muted line-through' : 'text-text-primary'
                }`}
              >
                {p.label}
              </p>
              {faite ? (
                <p className="eyebrow mt-auto text-text-muted">
                  {t('priorites.cocheeA', { heure: new Date(p.doneAt as string).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) })}
                </p>
              ) : (
                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void basculer(p)}
                    className="min-h-11 bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover md:min-h-0"
                  >
                    {t('priorites.cocher')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void reporter(p)}
                    className="flex min-h-11 items-center gap-1.5 border border-border px-3 py-2 text-[12.5px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0"
                  >
                    {t('priorites.reporter')} <ArrowRight size={12} strokeWidth={2.1} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void retirer(p)}
                    aria-label={t('priorites.supprimer')}
                    title={t('priorites.supprimer')}
                    className="ml-auto min-h-11 px-1 text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"
                  >
                    <Trash2 size={13} strokeWidth={1.9} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      {/* ── La bande des trente jours, et la série ──────────────────────── */}
      <motion.div variants={staggerItem} className="grid gap-4 md:grid-cols-[1fr_minmax(0,260px)]">
        <div className="panel p-5">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <p className="eyebrow">{t('priorites.trenteJours')}</p>
            <p className="eyebrow text-text-muted">{t('priorites.journeesTenues', { n: tenues })}</p>
          </div>
          <div className="flex gap-[3px]" aria-hidden>
            {bande.map((j) => (
              <span
                key={j.day}
                title={j.day}
                className={`h-8 flex-1 ${
                  j.aujourdhui ? 'bg-text-primary' : j.tenue ? 'bg-[#4a4a48]' : j.pose ? 'bg-[#2b2b2b]' : 'bg-[#161616]'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">
            <span>{new Date(`${debutBande}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</span>
            <span>{t('priorites.aujourdhui')}</span>
          </div>
        </div>

        {/*
          LA SÉRIE — le seul ambre de l'écran, et un chiffre à l'échelle d'un
          titre (règle 2 du jeton). Elle marque ce qui se perd si on ne fait
          rien aujourd'hui : c'est une décision, pas un état.
        */}
        <div className="panel flex flex-col justify-center gap-2 p-5">
          <p className="eyebrow">{t('priorites.serieEnCours')}</p>
          <p className="tnum font-mono text-[46px] font-bold leading-none tracking-[-0.04em] text-signal">{serie}</p>
          <p className="text-[13.5px] leading-[1.6] text-text-secondary">{t('priorites.serieExplication')}</p>
        </div>
      </motion.div>

      {items.length === 0 && !libre && (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('priorites.vide.titre')}>{t('priorites.vide.texte')}</FirstRun>
        </motion.div>
      )}
    </motion.section>
  );
}
