import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Nature = 'note' | 'panne' | 'visite' | 'decision' | 'incident';
interface EntryData {
  text: string;
  kind: Nature;
  byEmail: string;
  at: string;
}
const NATURES: Nature[] = ['note', 'panne', 'visite', 'decision', 'incident'];

/**
 * LE JOURNAL DE BORD — ce qui s'est passé, daté, relisible.
 *
 * Pour qui : une organisation dont la mémoire est orale. La panne du frigo
 * de mars, la visite du contrôleur, la décision de fermer le lundi : tout
 * finit par se perdre. Ce que ça règle : une entrée par événement notable,
 * signée, avec une nature pour retrouver vite. Le Fil est la conversation ;
 * le journal est ce qu'on garde.
 */
export function LogbookScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<EntryData>('logbook');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Nature>('note');
  const [filtre, setFiltre] = useState<Nature | 'tous'>('tous');

  const entrees = useMemo(() => [...brutes].sort((a, b) => b.at.localeCompare(a.at)), [brutes]);
  const visibles = filtre === 'tous' ? entrees : entrees.filter((e) => e.kind === filtre);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ceMois = entrees.filter((e) => e.at >= debutMois);
  const pannes = ceMois.filter((e) => e.kind === 'panne' || e.kind === 'incident').length;
  /*
    LA COUPE GÉOLOGIQUE — l'objet dominant (système de design, `17a`).

    Les entrées du mois s'empilent comme des couches de sédiment, la plus
    récente en haut, et l'ÉPAISSEUR de chaque couche est la longueur de ce qui
    a été écrit. « Rien de notable » fait une strate mince ; la mise au point
    du trimestre en fait une épaisse. On voit d'un coup d'œil les mois où il
    s'est passé quelque chose.

    LA RÈGLE QUI FAIT L'INSTRUMENT : l'épaisseur est PROPORTIONNELLE, jamais
    catégorielle. Trois paliers « court / moyen / long » détruiraient la coupe
    — elle redeviendrait une liste à trois tailles, et la comparaison entre
    deux entrées voisines ne voudrait plus rien dire. L'épaisseur s'interpole
    linéairement entre 22 et 96 px sur le nombre de mots réel.
  */
  const STRATE_MIN = 22;
  const STRATE_MAX = 96;
  const motsDe = (texte: string) => texte.trim().split(/\s+/).filter(Boolean).length;

  const coupe = useMemo(() => {
    const duMois = ceMois.map((e) => ({ ...e, mots: motsDe(e.text) }));
    if (duMois.length === 0) return null;
    const plancher = Math.min(...duMois.map((e) => e.mots));
    const plafond = Math.max(...duMois.map((e) => e.mots));
    const etendue = plafond - plancher;
    const strates = duMois.map((e) => ({
      ...e,
      epaisseur:
        etendue === 0
          ? (STRATE_MIN + STRATE_MAX) / 2
          : STRATE_MIN + ((e.mots - plancher) / etendue) * (STRATE_MAX - STRATE_MIN),
    }));
    /* La plus épaisse porte l'ambre. À égalité, la plus récente : c'est celle
       qu'on vient d'écrire, donc celle dont on se souvient. */
    const plusEpaisse = strates.reduce((a, b) => (b.mots > a.mots ? b : a));
    return { strates, plusEpaisse: plusEpaisse.id, plafond };
  }, [ceMois]);

  /* Les douze mois en barres de mots écrits, le mois courant en encre claire. */
  const douzeMois = useMemo(() => {
    const maintenant = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - (11 - i), 1);
      const debut = d.toISOString();
      const finMois = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const mots = entrees
        .filter((e) => e.at >= debut && e.at < finMois)
        .reduce((n, e) => n + motsDe(e.text), 0);
      return {
        cle: `${d.getFullYear()}-${d.getMonth()}`,
        lettre: d.toLocaleDateString('fr-FR', { month: 'narrow' }),
        mots,
        courant: i === 11,
      };
    });
  }, [entrees]);

  /*
    L'ANNÉE, EN TROIS FAITS. Le dernier — les jours sans écrire — est présenté
    comme un FAIT et non comme un manque : ce module n'a AUCUNE série à tenir,
    et « 43 jours sans écrire » ne doit pas se lire comme un reproche. C'est
    d'ailleurs écrit en toutes lettres dans le paquet, et c'est ce qui
    distingue ce module des Routines.
  */
  const annee = useMemo(() => {
    const debutAnnee = new Date(new Date().getFullYear(), 0, 1).toISOString();
    const delAnnee = entrees.filter((e) => e.at >= debutAnnee);
    const joursEcrits = new Set(delAnnee.map((e) => e.at.slice(0, 10)));
    const ecoules = Math.ceil((Date.now() - new Date(debutAnnee).getTime()) / 86_400_000);
    return {
      entrees: delAnnee.length,
      mots: delAnnee.reduce((n, e) => n + motsDe(e.text), 0),
      sansEcrire: Math.max(0, ecoules - joursEcrits.size),
    };
  }, [entrees]);

  const parJour = useMemo(() => {
    const m = new Map<string, (EntryData & { id: string })[]>();
    for (const e of visibles) {
      const jour = e.at.slice(0, 10);
      m.set(jour, [...(m.get(jour) ?? []), e]);
    }
    return [...m.entries()];
  }, [visibles]);
  const nature = (k: Nature) => t(`journalBord.kind.${k}` as Parameters<typeof t>[0]);

  const consigner = async () => {
    if (!text.trim()) return;
    await upsert('logbook', uid('log'), { text: text.trim(), kind, byEmail: user?.email ?? '', at: new Date().toISOString() });
    setText('');
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('journalBord.titre') })}
          title={t('journalBord.titre')}
          description={t('journalBord.description')}
          stats={[
            { label: t('journalBord.stat.mois'), value: ceMois.length },
            { label: t('journalBord.stat.pannes'), value: pannes, emphasis: pannes > 0 },
            { label: t('journalBord.stat.derniere'), value: entrees[0] ? relativeTime(entrees[0].at) : '—' },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void consigner(); }} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('journalBord.champ')} aria-label={t('journalBord.champ')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={t('journalBord.nature')} className="flex flex-wrap gap-1">
            {NATURES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1.5 ${kind === k ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}>{nature(k)}</button>
            ))}
          </div>
          <button type="submit" disabled={!text.trim()} className="ml-auto flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2"><Plus size={14} /> {t('journalBord.ajouter')}</button>
        </div>
      </motion.form>

      {entrees.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('journalBord.vide.titre')}>{t('journalBord.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* ── L'OBJET DOMINANT : la coupe du mois ─────────────────────── */}
          {coupe && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
              <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <span className="eyebrow text-text-secondary">
                  Ce mois-ci · {new Date().toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
                </span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                  {coupe.strates.length} ENTRÉE{coupe.strates.length > 1 ? 'S' : ''} ·{' '}
                  {coupe.strates.reduce((n, e) => n + e.mots, 0)} MOTS
                </span>
              </div>

              <div className="flex flex-col">
                {coupe.strates.map((e) => {
                  const ambre = coupe.plusEpaisse === e.id;
                  /* La clarté du fond suit l'épaisseur : une strate mince est
                     presque noire, une strate épaisse ressort. C'est la même
                     information, redondée, et c'est ce qui fait lire la pile
                     comme une coupe plutôt que comme une liste. */
                  const part = (e.epaisseur - STRATE_MIN) / (STRATE_MAX - STRATE_MIN);
                  const fond = ambre
                    ? undefined
                    : `rgba(255,255,255,${(0.015 + part * 0.05).toFixed(3)})`;
                  return (
                    <div
                      key={e.id}
                      data-signal-groupe={ambre ? 'strate-du-mois' : undefined}
                      className={`grid grid-cols-[96px_1fr_84px] items-center gap-4 border-b border-border-row px-3 last:border-b-0 ${
                        ambre ? 'bg-signal' : ''
                      }`}
                      style={{ height: `${e.epaisseur}px`, background: fond }}
                      title={`${e.mots} mots`}
                    >
                      <span
                        className={`tnum font-mono text-[10.5px] tracking-[0.08em] ${
                          ambre ? 'text-[#3a2a0e]' : 'text-text-muted'
                        }`}
                      >
                        {new Date(e.at).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })}
                      </span>
                      <span
                        className={`min-w-0 truncate text-[13.5px] ${
                          ambre ? 'font-semibold text-signal-ink' : 'text-text-secondary'
                        }`}
                      >
                        {e.text}
                      </span>
                      <span
                        className={`tnum text-right font-mono text-[11px] ${
                          ambre ? 'font-bold text-signal-ink' : 'text-text-muted'
                        }`}
                      >
                        {e.mots} mots
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── AUTOUR : l'année en barres, et trois faits ──────────────── */}
          <motion.div variants={staggerItem} className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
            <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
              <div className="mb-[18px] flex items-baseline justify-between gap-4">
                <span className="eyebrow text-text-secondary">Douze mois</span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">MOTS ÉCRITS</span>
              </div>
              <div className="flex h-[88px] items-end gap-2">
                {douzeMois.map((m) => {
                  const plafond = Math.max(1, ...douzeMois.map((x) => x.mots));
                  return (
                    <span
                      key={m.cle}
                      className={`flex-1 ${m.courant ? 'bg-text-primary' : 'bg-border-strong'}`}
                      style={{ height: `${Math.max(2, (m.mots / plafond) * 88)}px` }}
                      title={`${m.mots} mots`}
                    />
                  );
                })}
              </div>
              <div className="mt-2.5 flex gap-2 font-mono text-[9.5px] tracking-[0.1em]">
                {douzeMois.map((m) => (
                  <span
                    key={`l-${m.cle}`}
                    className={`flex-1 text-center ${m.courant ? 'text-text-primary' : 'text-text-muted'}`}
                  >
                    {m.lettre.toUpperCase()}
                  </span>
                ))}
              </div>
            </section>

            <section className="panel flex flex-col gap-4 px-5 pb-[18px] pt-5">
              <span className="eyebrow text-text-secondary">Cette année</span>
              <dl className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-text-secondary">Entrées</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-primary">{annee.entrees}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-text-secondary">Mots</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-primary">{annee.mots}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
                  <dt className="text-[13px] text-text-secondary">Jours sans écrire</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-secondary">{annee.sansEcrire}</dd>
                </div>
              </dl>
              {/* Un FAIT, pas un manque. Ce module n'a aucune série à tenir,
                  et la phrase existe pour que le chiffre au-dessus ne se lise
                  pas comme un reproche. */}
              <p className="text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                Un journal de bord ne se tient pas tous les jours. On y écrit quand il s’est passé
                quelque chose — le reste du temps, il n’y a rien à consigner.
              </p>
            </section>
          </motion.div>

          <motion.div variants={staggerItem} role="radiogroup" aria-label={t('journalBord.filtrer')} className="flex flex-wrap gap-1">
            {(['tous', ...NATURES] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={filtre === k} onClick={() => setFiltre(k)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1 ${filtre === k ? 'border-border-strong text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>
                {k === 'tous' ? t('journalBord.tous') : nature(k)}
              </button>
            ))}
          </motion.div>
          <motion.div variants={staggerItem} className="flex flex-col gap-4">
            {parJour.map(([jour, liste]) => (
              <section key={jour} aria-label={jour}>
                <p className="eyebrow mb-2">{new Date(`${jour}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <ul className="flex flex-col gap-2">
                  {liste.map((e) => (
                    <li key={e.id} className={`group flex gap-3 rounded-xl border bg-surface p-3 ${e.kind === 'panne' || e.kind === 'incident' ? 'border-warning/40' : e.kind === 'decision' ? 'border-accent/40' : 'border-border'}`}>
                      <span className="eyebrow mt-0.5 shrink-0">{nature(e.kind)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{e.text}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">{e.byEmail.split('@')[0]} · {new Date(e.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button type="button" onClick={() => void remove('logbook', e.id)} aria-label={t('journalBord.supprimer')} title={t('journalBord.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
