import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Circle, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { EcranVide } from '../components/EtatEcran';
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
  /* « 0/0 » est un relevé qui n'informe pas : il dit « rien n'est posé » avec
     la forme d'un échec. Un tiret dit la même chose sans le reproche. */
  const ratioDuJour = items.length === 0 ? '—' : `${faites}/${items.length}`;
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

  /*
    LA MOYENNE DE FENTES REMPLIES PAR JOUR OUVRÉ — la mesure de droite.

    Sur les jours ouvrés seulement : compter les week-ends ferait tomber la
    moyenne sous 2 chez quelqu'un qui tient parfaitement sa semaine, et
    l'écran dirait le contraire de ce qui s'est passé.
  */
  const moyenneOuvree = useMemo(() => {
    const ouvres = bande.filter((j) => {
      const d = new Date(`${j.day}T00:00:00`).getDay();
      return d !== 0 && d !== 6;
    });
    if (ouvres.length === 0) return null;
    const total = ouvres.reduce((n, j) => {
      const d = miens.find((x) => x.day === j.day);
      return n + (d?.items.length ?? 0);
    }, 0);
    return total / ouvres.length;
  }, [bande, miens]);

  const vide = items.length === 0 && trenteJours.length === 0;

  return (
    <EcranVide quand={vide} premierJour={vide}>
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6">
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
              : MAX - items.length === 0
                ? t('priorites.etatDuJourComplet')
                : MAX - items.length === 1
                  ? t('priorites.etatDuJourUnePlace', { faites })
                  : faites === 1
                    ? t('priorites.etatDuJourUneFaite', { restantes: MAX - items.length })
                    : t('priorites.etatDuJour', { faites, restantes: MAX - items.length })
          }
          phraseVide="Trois fentes vous attendent chaque matin. Une fente vide est une fente gagnée."
          stats={[
            { label: t('priorites.stat.aujourdhui'), value: ratioDuJour, emphasis: items.length > 0 && faites === items.length },
            { label: t('priorites.stat.journeesTenues'), value: tenues },
            { label: t('priorites.stat.serie'), value: serie },
          ]}
        />
      </motion.div>

      {/*
        ── L'OBJET DOMINANT : TROIS FENTES, PAS UNE DE PLUS ────────────────

        Elles sont dessinées qu'elles soient pleines ou vides, et c'est tout
        l'instrument : la contrainte du module devient physique. Une liste de
        priorités s'allonge toujours ; trois fentes, non. Le nombre est en dur
        (`MAX`), il n'y a pas de quatrième fente et pas de « voir plus ».

        L'AMBRE est la PREMIÈRE fente — celle qui doit tomber avant ce soir.
        Pas la série, pas le compteur : la chose à faire. C'est le seul point
        de l'écran sur lequel on agit aujourd'hui.
      */}
      <motion.section variants={staggerItem} className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
        <div className="mb-[22px] flex items-baseline justify-between">
          <span className="eyebrow text-text-secondary">Aujourd’hui</span>
          <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
            {items.length === 0
              ? 'TROIS FENTES LIBRES'
              : `${faites} FAITE${faites > 1 ? 'S' : ''} SUR ${items.length}`}
          </span>
        </div>

        <div className="grid gap-[18px] md:grid-cols-3">
          {places.map((p, i) => {
            if (!p) {
              const premierLibre = items.length === i;
              return (
                <div
                  key={`libre-${i}`}
                  className="flex min-h-[176px] flex-col border border-dashed border-border-section p-[22px]"
                >
                  <span className="tnum font-mono text-[12.5px] text-text-muted">0{i + 1}</span>
                  <span className="mt-3 text-[19px] font-semibold leading-[1.25] text-text-muted">Libre</span>
                  {/* La fente vide N'APPELLE PAS à être remplie : pas d'action
                      primaire, pas de bouton. Un champ nu, et une phrase qui
                      dit que ce vide n'est pas un manque. */}
                  <span className="mt-2 text-[13.5px] leading-[1.6] text-text-secondary">
                    Une fente vide est une fente gagnée.
                  </span>
                  {premierLibre && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        void poser();
                      }}
                      className="mt-auto"
                    >
                      <input
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder={t('priorites.champ')}
                        aria-label={t('priorites.champ')}
                        className="min-h-11 w-full border-b border-border bg-transparent pb-1 text-[13.5px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-text-primary"
                      />
                    </form>
                  )}
                </div>
              );
            }
            const faite = Boolean(p.doneAt);
            /* La première fente porte l'ambre TANT QU'ELLE N'EST PAS FAITE :
               une fente cochée ne demande plus rien, donc ne signale plus. */
            const ambre = i === 0 && !faite;
            return (
              <div
                key={p.id}
                data-signal-groupe={ambre ? 'premiere-fente' : undefined}
                className={`group flex min-h-[176px] flex-col p-[22px] ${
                  ambre
                    ? 'bg-signal shadow-[0_0_30px_-6px_var(--color-signal-glow)]'
                    : 'border border-border bg-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`tnum font-mono text-[12.5px] ${ambre ? 'text-[#3a2a0e]' : 'text-text-muted'}`}>
                    0{i + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => void basculer(p)}
                    aria-pressed={faite}
                    aria-label={t('priorites.cocher')}
                    className={`-m-2 p-2 transition-opacity hover:opacity-70 ${
                      ambre ? 'text-signal-ink' : 'text-text-muted'
                    }`}
                  >
                    {faite ? (
                      <Check size={17} strokeWidth={2.1} className="text-text-primary" />
                    ) : (
                      <Circle size={17} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
                <span
                  className={`mt-3 text-[19px] font-semibold leading-[1.25] ${
                    ambre ? 'text-signal-ink' : faite ? 'text-text-muted line-through' : 'text-text-primary'
                  }`}
                >
                  {p.label}
                </span>
                {faite ? (
                  <span className="eyebrow mt-auto text-text-muted">
                    {t('priorites.cocheeA', {
                      heure: new Date(p.doneAt as string).toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    })}
                  </span>
                ) : (
                  <span className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                    <button
                      type="button"
                      onClick={() => void reporter(p)}
                      className={`flex min-h-11 items-center gap-1.5 border px-3 py-2 text-[12.5px] transition-colors md:min-h-0 ${
                        ambre
                          ? 'border-[#8a6528] text-signal-ink hover:border-signal-ink'
                          : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
                      }`}
                    >
                      {t('priorites.reporter')} <ArrowRight size={12} strokeWidth={2.1} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void retirer(p)}
                      aria-label={t('priorites.supprimer')}
                      title={t('priorites.supprimer')}
                      className={`ml-auto min-h-11 px-1 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 md:min-h-0 ${
                        ambre ? 'text-[#3a2a0e] hover:text-signal-ink' : 'text-text-muted hover:text-danger'
                      }`}
                    >
                      <Trash2 size={13} strokeWidth={1.9} />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* ── AUTOUR : les trente jours en colonnes de trois cases ────────── */}
      <motion.div variants={staggerItem} className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
        <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
          <div className="mb-[18px] flex items-baseline justify-between gap-4">
            <span className="eyebrow text-text-secondary">{t('priorites.trenteJours')}</span>
            <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
              {t('priorites.journeesTenues', { n: tenues })}
            </span>
          </div>
          {/*
            UNE COLONNE DE TROIS CASES PAR JOUR — et c'est la forme qui prouve
            la règle. Une barre par jour dirait seulement « il s'est passé
            quelque chose » ; trois cases montrent qu'on n'a JAMAIS mis une
            quatrième priorité, parce qu'il n'y a jamais de quatrième case.
          */}
          <div className="flex items-end gap-[3px]" aria-hidden>
            {bande.map((j) => {
              const d = miens.find((x) => x.day === j.day);
              const posees = d?.items.length ?? 0;
              const cochees = d?.items.filter((i) => i.doneAt).length ?? 0;
              return (
                <span key={j.day} title={j.day} className="flex flex-1 flex-col-reverse gap-[3px]">
                  {[0, 1, 2].map((k) => (
                    <span
                      key={k}
                      className={`h-3.5 ${
                        k < cochees
                          ? j.aujourdhui
                            ? 'bg-text-primary'
                            : 'bg-[#4a4a48]'
                          : k < posees
                            ? 'bg-[#2b2b2b]'
                            : 'border border-border'
                      }`}
                    />
                  ))}
                </span>
              );
            })}
          </div>
          <div className="mt-2.5 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">
            <span>
              {new Date(`${debutBande}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
            </span>
            <span>{t('priorites.aujourdhui')}</span>
          </div>
        </section>

        <section className="panel flex flex-col px-5 pb-[18px] pt-5">
          <span className="eyebrow mb-5 text-text-secondary">Fentes remplies</span>
          <span className="tnum block font-mono text-[40px] font-bold leading-[.92] tracking-[-0.04em] text-text-primary">
            {moyenneOuvree === null ? '—' : moyenneOuvree.toFixed(1).replace('.', ',')}
          </span>
          <span className="mt-2.5 block text-[13.5px] leading-[1.55] text-text-secondary">
            en moyenne par jour ouvré, sur les trente derniers jours.
          </span>
          <span className="mt-4 block border-t border-border pt-4 font-mono text-[10px] tracking-[0.1em] text-text-muted">
            SÉRIE EN COURS · {serie} JOUR{serie > 1 ? 'S' : ''}
          </span>
        </section>
      </motion.div>

      {vide && (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('priorites.vide.titre')}>{t('priorites.vide.texte')}</FirstRun>
        </motion.div>
      )}
    </motion.section>
    </EcranVide>
  );
}
