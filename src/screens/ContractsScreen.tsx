import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Signature, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { Champ, Case } from '../components/formulaire/Champ';
import { FormulaireEnPlace } from '../components/formulaire/FormulaireEnPlace';
import { formatCents } from '../lib/money';
import { useCollection, useSync } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

/**
 * CONTRATS — l'échéance la plus proche domine l'écran (système de design, 3d).
 *
 * L'écran était un registre plat : une ligne par contrat, triée par date de
 * fin. Tout y était, rien n'y ressortait — or un contrat ne se consulte pas,
 * il s'ATTEND : la seule question qu'on pose à cet écran, c'est « qu'est-ce
 * qui tombe bientôt, et qu'est-ce que je fais ». D'où la composition :
 *
 *   · une CARTE DE TÊTE pour l'échéance la plus proche, avec ses deux gestes
 *     (reconduire, terminer) sous la main ;
 *   · un ÉCHÉANCIER sur douze mois, qui montre les creux et les grappes ;
 *   · le registre en dessous, qui garde tout le reste.
 *
 * L'UNIQUE AMBRE de l'écran est le compte à rebours (J-11) : c'est ce qui
 * demande une décision. Ni le statut « en cours », ni la reconduction tacite,
 * ni le montant — ceux-là vont bien, et ce qui va bien reste en encre.
 */

type ContractStatus = 'draft' | 'active' | 'ended';

interface ContractData {
  title: string;
  party: string;
  startsAt: string;
  endsAt: string;
  amountCents: number;
  status: ContractStatus;
  autoRenew: boolean;
  note: string;
  createdAt: string;
}

const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
const dansJours = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoDay(d);
};
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
/** Combien de jours d'ici la date, en jours pleins. Négatif = déjà passée. */
const joursAvant = (jour: string) =>
  Math.round((new Date(`${jour}T00:00:00`).getTime() - new Date(`${isoDay()}T00:00:00`).getTime()) / 86_400_000);

export function ContractsScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ContractData>('contracts');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [startsAt, setStartsAt] = useState(isoDay());
  const [endsAt, setEndsAt] = useState(dansJours(365));
  const [amount, setAmount] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const jour = isoDay();
  const bientot = dansJours(30);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const date = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  const dateCourte = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });

  const contrats = useMemo(() => [...brutes].sort((a, b) => a.endsAt.localeCompare(b.endsAt)), [brutes]);
  const actifs = contrats.filter((c) => c.status === 'active');
  const echeants = actifs.filter((c) => c.endsAt >= jour && c.endsAt <= bientot);
  const valeur = actifs.reduce((n, c) => n + (c.amountCents || 0), 0);

  /* La tête : le contrat actif dont la fin est la plus proche, passées exclues. */
  const tete = useMemo(() => actifs.find((c) => c.endsAt >= jour) ?? null, [actifs, jour]);
  const suite = useMemo(() => actifs.filter((c) => c.endsAt >= jour && c.id !== tete?.id), [actifs, jour, tete]);

  /*
    L'ÉCHÉANCIER — douze mois à partir de celui-ci, et ce qui y tombe.
    Calculé sur les vraies dates de fin : jamais une série d'exemple, c'est la
    règle que `check:vitaux` tient sur tout ce qui ressemble à une courbe.
  */
  const echeancier = useMemo(() => {
    const debut = new Date();
    debut.setDate(1);
    debut.setHours(0, 0, 0, 0);
    return Array.from({ length: 12 }, (_, i) => {
      const mois = new Date(debut);
      mois.setMonth(mois.getMonth() + i);
      const cle = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, '0')}`;
      const dedans = actifs.filter((c) => c.endsAt.startsWith(cle));
      return {
        cle,
        label: mois.toLocaleDateString(locale, { month: 'short' }).replace('.', ''),
        nombre: dedans.length,
        montant: dedans.reduce((n, c) => n + (c.amountCents || 0), 0),
        courant: i === 0,
      };
    });
  }, [actifs, locale]);
  const maxMois = Math.max(1, ...echeancier.map((m) => m.nombre));

  const ajouter = async () => {
    if (!title.trim()) return;
    await upsert('contracts', uid('ctr'), {
      title: title.trim(),
      party: party.trim(),
      startsAt,
      endsAt,
      amountCents: Math.round((Number(amount.replace(',', '.')) || 0) * 100),
      status: 'active',
      autoRenew,
      note: '',
      createdAt: new Date().toISOString(),
    });
    setTitle('');
    setParty('');
    setAmount('');
    setAutoRenew(false);
    setOuvert(false);
  };
  const statut = (s: ContractStatus) => t(`contrats.statut.${s}` as Parameters<typeof t>[0]);
  const reconduire = (c: ContractData & { id: string }) =>
    void upsert('contracts', c.id, { ...c, startsAt: c.endsAt, endsAt: dansJours(365) });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-7">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('contrats.titre') })}
          title={t('contrats.titre')}
          description={echeants.length > 0 ? t('contrats.echeants', { n: echeants.length }) : t('contrats.description')}
          stats={[
            { label: t('contrats.stat.actifs'), value: actifs.length },
            { label: t('contrats.stat.valeur'), value: formatCents(valeur) },
            { label: t('contrats.stat.echeants'), value: echeants.length, emphasis: echeants.length > 0 },
          ]}
          actions={
            <button
              type="button"
              onClick={() => setOuvert((v) => !v)}
              className="flex items-center gap-2 bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={15} strokeWidth={2.1} /> {t('contrats.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <FormulaireEnPlace
          titre={t('contrats.ajouter')}
          note={t('form.enPlace')}
          empeche={title.trim() ? undefined : t('contrats.form.sansIntitule')}
          onEnregistrer={() => void ajouter()}
          onFermer={() => setOuvert(false)}
          libelleEnregistrer={t('contrats.enregistrer')}
          libelleFermer={t('chrome.fermer')}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Champ intitule={t('contrats.champ.intitule')} aide={t('contrats.champ.intituleAide')}>
              <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            </Champ>
            <Champ intitule={t('contrats.champPartie')}>
              <input value={party} onChange={(e) => setParty(e.target.value)} />
            </Champ>
            <Champ intitule={t('contrats.champDebut')}>
              <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </Champ>
            <Champ intitule={t('contrats.champFin')}>
              <input type="date" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </Champ>
            <Champ intitule={t('contrats.champ.montant')} suffixe="€">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
            </Champ>
            <div className="flex items-end pb-1">
              <Case coche={autoRenew} onChange={setAutoRenew}>
                {t('contrats.reconduction')}
              </Case>
            </div>
          </div>
        </FormulaireEnPlace>
      )}

      {contrats.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun
            icone={Signature}
            title={t('contrats.vide.titre')}
            action={{ label: t('contrats.vide.action'), onClick: () => setOuvert(true) }}
          >
            {t('contrats.vide.texte')}
          </FirstRun>
        </motion.div>
      ) : (
        <>
          {/* ── La carte de tête : l'échéance la plus proche ─────────────── */}
          {tete && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide grid grid-cols-1 md:grid-cols-[minmax(0,260px)_1fr]">
              {/*
                LA PLAQUE — le seul ambre de l'écran. Le compte à rebours est un
                chiffre à l'échelle d'un titre : il tient le contraste (règle 2
                du jeton), et c'est lui qui appelle la décision.
              */}
              <div className="signal-plate flex flex-col justify-between p-6">
                <div>
                  <p className="font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] opacity-70">
                    {t('contrats.prochaineEcheance')}
                  </p>
                  <p className="tnum mt-3 font-mono text-[60px] font-bold leading-[0.92] tracking-[-0.04em]">
                    J−{Math.max(0, joursAvant(tete.endsAt))}
                  </p>
                </div>
                <p className="mt-6 font-mono text-[10px] font-bold uppercase leading-[1.7] tracking-[0.14em] opacity-80">
                  {t('contrats.finLe', { date: date(tete.endsAt) })}
                  {tete.autoRenew && <><br />{t('contrats.reconductionCourt')}</>}
                </p>
              </div>

              <div className="flex flex-col gap-5 p-6">
                <div>
                  <p className="eyebrow">
                    {statut(tete.status)} · {tete.title}
                  </p>
                  <p className="mt-2 text-[26px] font-bold leading-[1.1] tracking-[-0.028em] text-text-primary">
                    {tete.party || t('contrats.sansPartie')}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {[
                    { label: t('contrats.champ.montant'), valeur: tete.amountCents > 0 ? formatCents(tete.amountCents) : '—' },
                    { label: t('contrats.champDebut'), valeur: dateCourte(tete.startsAt) },
                    { label: t('contrats.champFin'), valeur: dateCourte(tete.endsAt) },
                    {
                      label: t('contrats.colonneReconduction'),
                      valeur: tete.autoRenew ? t('contrats.tacite') : t('contrats.nonTacite'),
                    },
                  ].map((col, i) => (
                    <div key={col.label} className={i > 0 ? 'border-l border-border-section pl-8' : ''}>
                      <p className="eyebrow mb-1.5">{col.label}</p>
                      <p className="tnum font-mono text-[21px] font-semibold tracking-[-0.03em] text-text-primary">
                        {col.valeur}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => reconduire(tete)}
                    className="bg-accent px-4 py-2.5 text-[12.5px] font-semibold text-bg transition-colors hover:bg-accent-hover"
                  >
                    {t('contrats.reconduire12')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void upsert('contracts', tete.id, { ...tete, status: 'ended' })}
                    className="border border-border-strong px-4 py-2.5 text-[12.5px] font-semibold text-text-secondary transition-colors hover:border-text-muted hover:text-text-primary"
                  >
                    {t('contrats.terminer')}
                  </button>
                  {joursAvant(tete.endsAt) <= 30 && (
                    <p className="eyebrow ml-auto text-text-muted">{t('contrats.echeantTrente')}</p>
                  )}
                </div>
              </div>
            </motion.section>
          )}

          {/* ── L'échéancier : douze mois, les creux et les grappes ───────── */}
          {actifs.length > 0 && (
            <motion.section variants={staggerItem}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="eyebrow">{t('contrats.echeancier')}</p>
                <p className="eyebrow text-text-muted">{t('contrats.douzeMois')}</p>
              </div>
              {/*
                UN TRAIT PAR CONTRAT, pas une barre par mois. La différence
                n'est pas cosmétique : un mois à trois échéances se LIT comme
                trois, sans qu'on ait à comparer des hauteurs. C'est ce qui fait
                voir les grappes — et les creux, qui comptent autant quand on
                place une nouvelle échéance.
              */}
              <div className="grid grid-cols-12 gap-px bg-border">
                {echeancier.map((mois) => (
                  <div
                    key={mois.cle}
                    title={
                      mois.nombre > 0
                        ? t('contrats.moisDetail', { n: mois.nombre, montant: formatCents(mois.montant) })
                        : undefined
                    }
                    className="flex h-[104px] flex-col bg-bg px-2 pb-2 pt-2"
                  >
                    <span className="tnum font-mono text-[10px] text-text-secondary">
                      {mois.nombre > 0 ? mois.nombre : ''}
                    </span>
                    <div className="mt-auto flex h-[58px] items-end gap-[3px]" aria-hidden>
                      {Array.from({ length: Math.min(mois.nombre, 6) }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-[3px] ${mois.courant ? 'bg-[#4a4a48]' : 'bg-[#3a3a3a]'}`}
                          style={{ height: `${28 + ((i * 7) % 24)}px` }}
                        />
                      ))}
                      {mois.nombre === 0 && <span className="h-[2px] w-full bg-[#1f1f1f]" />}
                    </div>
                    <span className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                      {mois.label}
                    </span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── La suite : ce qui vient après la tête ─────────────────────── */}
          {suite.length > 0 && (
            <motion.div variants={staggerItem} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {suite.slice(0, 3).map((c) => (
                <div key={c.id} className="panel flex flex-col gap-2 p-4">
                  <p className="eyebrow">
                    {new Date(`${c.endsAt}T00:00:00`).toLocaleDateString(locale, { month: 'short' }).replace('.', '')} ·
                    J−{Math.max(0, joursAvant(c.endsAt))}
                  </p>
                  <p className="truncate text-[14.5px] font-semibold text-text-primary">
                    {c.party || c.title}
                  </p>
                  <p className="tnum font-mono text-[13px] text-text-secondary">
                    {c.amountCents > 0 ? formatCents(c.amountCents) : '—'}
                    {c.autoRenew && <span className="text-text-muted"> · {t('contrats.anCourt')}</span>}
                  </p>
                </div>
              ))}
              {suite.length > 3 && (
                <div className="panel flex flex-col justify-center gap-1.5 p-4">
                  <p className="tnum font-mono text-[23px] font-semibold tracking-[-0.03em] text-text-primary">
                    + {suite.length - 3}
                  </p>
                  <p className="eyebrow text-text-muted">{t('contrats.autresApres')}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ── Le registre : tout, y compris ce qui est terminé ──────────── */}
          <motion.div variants={staggerItem}>
            <p className="eyebrow mb-3">{t('contrats.registre')}</p>
            <ul className="flex flex-col">
              {contrats.map((c) => {
                const proche = c.status === 'active' && c.endsAt >= jour && c.endsAt <= bientot;
                const passe = c.endsAt < jour;
                return (
                  <li
                    key={c.id}
                    className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#161616] py-3.5 ${
                      c.status === 'ended' ? 'text-text-muted' : ''
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Signature
                        size={16}
                        strokeWidth={1.9}
                        className={`flex-shrink-0 ${proche ? 'text-text-primary' : 'text-text-muted'}`}
                      />
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-text-primary">
                          {c.title}
                          {c.party && <span className="text-text-muted"> · {c.party}</span>}
                        </p>
                        <p className="tnum font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
                          {date(c.startsAt)} →{' '}
                          <span className={passe && c.status === 'active' ? 'text-danger-ink' : ''}>
                            {date(c.endsAt)}
                          </span>
                          {c.amountCents > 0 && ` · ${formatCents(c.amountCents)}`}
                          {c.autoRenew && ` · ${t('contrats.reconductionCourt')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                      <span className="eyebrow text-text-muted">{statut(c.status)}</span>
                      {c.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => void upsert('contracts', c.id, { ...c, status: 'ended' })}
                          className="min-h-11 border border-border px-3 text-[12px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-1.5"
                        >
                          {t('contrats.terminer')}
                        </button>
                      )}
                      {c.status === 'active' && c.autoRenew && passe && (
                        <button
                          type="button"
                          onClick={() => reconduire(c)}
                          className="min-h-11 border border-border-strong px-3 text-[12px] text-text-primary md:min-h-0 md:py-1.5"
                        >
                          {t('contrats.reconduire')}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void remove('contracts', c.id)}
                        aria-label={t('contrats.supprimer')}
                        title={t('contrats.supprimer')}
                        className="flex min-h-11 items-center border border-border px-2.5 text-text-muted transition-colors hover:border-danger/40 hover:text-danger md:min-h-0 md:py-1.5"
                      >
                        <Trash2 size={13} strokeWidth={1.9} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
