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
 * ## Ce qui domine : celui qui attend VOTRE voix
 *
 * L'écran affichait une grille de cartes égales. Un sondage clos depuis une
 * semaine, un sondage où tout le monde a voté sauf moi, et un sondage en cours
 * y avaient la même taille et la même encre — alors qu'un seul des trois
 * demande quelque chose à celui qui regarde.
 *
 * Le compte était pourtant là : `aVoter` se calculait, et s'affichait comme un
 * relevé d'en-tête, à un mètre de la carte qu'il désignait. Savoir qu'« il y en
 * a un » sans savoir LEQUEL n'avance à rien.
 *
 * Le premier sondage sans ma voix passe donc en tête, à pleine largeur, ses
 * choix en barres qu'on lit de loin. Les autres descendent en registre d'une
 * ligne — un sondage déjà voté n'est plus une question, c'est un résultat.
 *
 * ## L'ambre
 *
 * Sur « il attend votre voix », et nulle part ailleurs. C'est la seule
 * DÉCISION de l'écran : voter est un geste que personne ne peut faire à ma
 * place. Un sondage clos est un fait, un sondage déjà voté est un fait ; ni
 * l'un ni l'autre n'appelle quoi que ce soit.
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
  const enAttenteDeMoi = ouverts.filter((s) => s.votes?.[moi] === undefined);
  const aVoter = enAttenteDeMoi.length;

  /*
    LA TÊTE : le plus ANCIEN de ceux qui attendent ma voix.

    Le plus ancien, pas le plus récent : un sondage qui traîne bloque une
    décision que les autres ont déjà prise. Le dernier arrivé, lui, peut
    attendre demain sans rien retenir.
  */
  const aTrancher = enAttenteDeMoi.length > 0 ? enAttenteDeMoi[enAttenteDeMoi.length - 1] : null;
  const reste = sondages.filter((s) => s.id !== aTrancher?.id);

  /* « 4 vote(s) » ne se lit dans aucune des deux langues. Le français dit
     « voix », invariable ; l'anglais accorde. La pluralisation vit dans les
     composants (voir src/i18n/index.ts), donc le choix se fait ici. */
  const voixDites = (n: number) => (n === 1 ? t('sondages.participantUn') : t('sondages.participants', { n }));

  /** Les comptes d'un sondage, dans l'ordre de ses options. */
  const comptesDe = (s: PollData) => {
    const votes = s.votes ?? {};
    return s.options.map((_, i) => Object.values(votes).filter((v) => v === i).length);
  };
  /** L'option en tête, et son avance. Sert au registre : un résultat en une ligne. */
  const enTeteDe = (s: PollData) => {
    const comptes = comptesDe(s);
    const max = Math.max(0, ...comptes);
    const index = comptes.indexOf(max);
    const total = Object.keys(s.votes ?? {}).length;
    return { libelle: s.options[index] ?? '', voix: max, total, exaequo: comptes.filter((c) => c === max).length > 1 };
  };

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
        <>
          {/*
            LA QUESTION QUI ATTEND — l'objet dominant.

            Pleine largeur, question à l'échelle d'un titre, et les choix en
            barres hautes : un sondage se lit par sa RÉPARTITION, et une
            répartition ne se lit pas dans une carte de trois cents pixels.
          */}
          {aTrancher && (
            <motion.section
              variants={staggerItem}
              className="panel-raised p-5 sm:p-6"
              data-signal-groupe="attend-ma-voix"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="signal-plate px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
                  {t('sondages.attendVotreVoix')}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {profileFor(aTrancher.createdBy).name} · {relativeTime(aTrancher.createdAt)} ·{' '}
                  {voixDites(Object.keys(aTrancher.votes ?? {}).length)}
                  {aTrancher.anonymous && ` · ${t('sondages.anonymeCourt')}`}
                </span>
              </div>

              <p className="mt-3.5 text-[23px] font-semibold leading-snug text-text-primary [overflow-wrap:anywhere] sm:text-[27px]">
                {aTrancher.question}
              </p>

              <ol className="mt-5 flex flex-col gap-2">
                {aTrancher.options.map((option, i) => {
                  const comptes = comptesDe(aTrancher);
                  const total = Object.keys(aTrancher.votes ?? {}).length;
                  const part = total > 0 ? Math.round((comptes[i] / total) * 100) : 0;
                  const votants = aTrancher.anonymous
                    ? []
                    : Object.entries(aTrancher.votes ?? {}).filter(([, v]) => v === i).map(([e]) => e);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => void voter(aTrancher, i)}
                        className="input-focus relative flex min-h-[52px] w-full items-center justify-between gap-3 overflow-hidden border border-border bg-surface px-4 text-left transition-colors hover:border-border-strong"
                      >
                        {/* La barre est le FOND de l'option, pas une jauge à côté :
                            c'est ce qui fait qu'on lit la répartition sans lire
                            les pourcentages. */}
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 bg-elevated transition-[width] duration-500 motion-reduce:transition-none"
                          style={{ width: `${part}%` }}
                        />
                        <span className="relative min-w-0 truncate text-[15px] text-text-primary">{option}</span>
                        <span className="relative flex flex-shrink-0 items-center gap-2.5">
                          {votants.slice(0, 4).map((e) => (
                            <UserAvatar key={e} email={e} size={20} />
                          ))}
                          <span className="tnum font-mono text-xs text-text-secondary">
                            {comptes[i]} · {part} %
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </motion.section>
          )}

          {/*
            LE REGISTRE — une ligne par sondage réglé.

            Un sondage déjà voté n'est plus une question : c'est un résultat. Il
            se lit donc comme un résultat — l'option en tête et son avance, sur
            une ligne — et non comme une carte qu'on pourrait confondre avec
            celle du haut.
          */}
          {reste.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <p className="eyebrow border-b border-border px-4 py-2.5">{t('sondages.registre')}</p>
              <ul className="flex flex-col">
                {reste.map((s) => {
                  const tete = enTeteDe(s);
                  const clos = Boolean(s.closedAt);
                  const peutClore = !clos && (s.createdBy === moi || isAdminRole(role));
                  return (
                    <li
                      key={s.id}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 last:border-b-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">{s.question}</span>
                        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {profileFor(s.createdBy).name} · {relativeTime(s.createdAt)} ·{' '}
                          {voixDites(tete.total)}
                          {clos && ` · ${t('sondages.clos')}`}
                        </span>
                      </span>

                      {/* L'ex æquo se dit, il ne se cache pas derrière un
                          « en tête » qui serait faux. */}
                      <span className="flex flex-shrink-0 items-center gap-2">
                        {clos ? (
                          <Lock size={11} className="text-text-muted" />
                        ) : (
                          <Vote size={12} className="text-text-muted" />
                        )}
                        <span className="text-sm text-text-secondary">
                          {tete.exaequo ? t('sondages.exaequo') : tete.libelle}
                        </span>
                        <span className="tnum font-mono text-[11px] text-text-muted">
                          {tete.voix}/{tete.total}
                        </span>
                      </span>

                      {(peutClore || s.createdBy === moi || isAdminRole(role)) && (
                        <span className="flex flex-shrink-0 gap-2">
                          {peutClore && (
                            <button
                              type="button"
                              onClick={() => void clore(s)}
                              className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary"
                            >
                              {t('sondages.clore')}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void remove('polls', s.id)}
                            className="border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted hover:border-danger/60 hover:text-danger"
                          >
                            {t('sondages.supprimer')}
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}
