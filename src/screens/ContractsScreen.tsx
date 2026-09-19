import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Signature, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { Champ, Case } from '../components/formulaire/Champ';
import { FormulaireEnPlace } from '../components/formulaire/FormulaireEnPlace';
import { formatCents } from '../lib/money';
import { useHaloSignal } from '../components/EtatEcran';
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
    L'ANCIEN ÉCHÉANCIER A ÉTÉ RETIRÉ.

    Il comptait les fins PAR MOIS, en petits traits : un mois à trois
    échéances se lisait comme trois traits. La frise (`14b`) dit la même chose
    et davantage, parce qu'une barre porte SA durée : on ne voit plus quand
    les fins tombent, on voit combien il reste à chacune. Garder les deux
    aurait donné deux objets qui répondent à la même question sur le même
    écran, et l'un des deux n'aurait servi qu'à occuper la place.
  */

  /* ------------------------------------------------- la frise (14b) ----- */

  const bornes = useMemo(() => bornesDeFrise(), []);
  const barres = useMemo(
    () => barresDeFrise(actifs.filter((c) => c.endsAt >= jour || c.autoRenew), bornes),
    [actifs, bornes, jour],
  );
  /* L'AMBRE va à la barre la plus courte — celle qui finit le plus tôt. Un
     tacite n'en est jamais : il ne finit pas. */
  const barreAmbre = useMemo(() => barres.find((b) => !b.tacite) ?? null, [barres]);
  const halo = useHaloSignal(!!barreAmbre);

  /*
    CE QUI TOMBE AVEC LE CONTRAT DE TÊTE. Le modèle ne lie PAS un abonnement à
    un contrat — il n'y a pas de clé entre les deux collections. Le
    rapprochement se fait donc par nom de partie, normalisé, et l'écran le dit
    plutôt que de laisser croire à un lien qu'il n'a pas. C'est fragile par
    construction, et c'est écrit ici pour que personne ne s'en étonne.
  */
  const abonnements = useCollection<{ label: string; customerName: string; amountCents: number; active: boolean }>(
    'subscriptions',
  );
  const nomNet = (v: string) =>
    v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const tombentAvec = useMemo(() => {
    if (!tete?.party) return [];
    const cible = nomNet(tete.party);
    return abonnements.filter((a) => a.active && nomNet(a.customerName) === cible);
  }, [abonnements, tete]);

  /* Les contrats qui portent le récurrent : les plus gros, jusqu'à six. */
  const lourds = useMemo(
    () => [...actifs].sort((a, b) => b.amountCents - a.amountCents).slice(0, 6),
    [actifs],
  );

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
          {/* ── LA FRISE DES FINS — l'objet dominant (`14b`) ─────────────── */}
          {barres.length > 0 && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="eyebrow">{t('contrats.echeancier')} · {t('contrats.douzeMois')}</p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  la longueur est le temps qu’il reste à courir
                </p>
              </div>

              <div className="relative">
                {/* Les repères de mois, DERRIÈRE les barres et dans la même
                    boîte qu'elles : une graduation posée dans une autre boîte
                    ne gradue plus rien. */}
                <div className="pointer-events-none absolute inset-0" aria-hidden>
                  {bornes.mois.map((m, i) => (
                    <span
                      key={m.cle}
                      className={`absolute inset-y-0 w-px ${i === 0 ? 'bg-border-strong' : 'bg-border'}`}
                      style={{ left: `${m.part}%` }}
                    />
                  ))}
                </div>

                <div className="relative flex flex-col gap-1.5">
                  {barres.map((b) => {
                    const signal = b === barreAmbre;
                    return (
                      <div
                        key={b.contrat.id}
                        className="relative"
                        style={{ height: FRISE_LIGNE_H }}
                        title={`${b.contrat.title} · ${b.tacite ? 'tacite' : date(b.contrat.endsAt)}`}
                      >
                        <span
                          className={`absolute inset-y-0 left-0 flex items-center overflow-hidden px-2 ${
                            signal ? `bg-signal ${halo}` : b.tacite ? '' : 'bg-[#2b2b2b]'
                          }`}
                          style={{
                            width: `${b.part}%`,
                            /* LE FONDU DU TACITE : la barre court jusqu'au
                               bord et s'y dissout, parce qu'elle ne finit pas.
                               Un cap lui inventerait une échéance. */
                            ...(b.tacite
                              ? {
                                  backgroundImage:
                                    'linear-gradient(to right, #3a3a3a 0%, #2b2b2b 55%, transparent 100%)',
                                }
                              : {}),
                          }}
                          data-signal-groupe={signal ? 'echeance' : undefined}
                        >
                          {b.tacite ? (
                            <span className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">
                              {b.contrat.title} · tacite · sans échéance
                            </span>
                          ) : (
                            b.nomDedans && (
                              <span
                                className={`truncate text-[12.5px] font-semibold ${
                                  signal ? 'text-signal-ink' : 'text-text-primary'
                                }`}
                                data-signal-groupe={signal ? 'echeance' : undefined}
                              >
                                {b.contrat.title}
                              </span>
                            )
                          )}
                        </span>

                        {/* LE CAP — 2 px, à la fin exacte. Le tacite n'en a pas. */}
                        {!b.tacite && (
                          <span
                            className={`absolute inset-y-0 w-0.5 ${signal ? 'bg-signal' : 'bg-text-secondary'}`}
                            style={{ left: `calc(${b.part}% - 2px)` }}
                            data-signal-groupe={signal ? 'echeance' : undefined}
                            aria-hidden
                          />
                        )}

                        {/* LE NOM ET LA DATE POSÉS APRÈS LE CAP, quand la barre
                            est trop courte pour les porter. Ils restent DANS
                            l'axe : au-delà des trois quarts, ils basculent
                            avant le cap plutôt que de sortir de la boîte. */}
                        {!b.tacite && !b.nomDedans && (
                          <span
                            className={`absolute top-1/2 flex -translate-y-1/2 items-baseline gap-2 whitespace-nowrap ${
                              signal ? 'text-signal' : 'text-text-secondary'
                            }`}
                            style={
                              b.part > 74
                                ? { right: `calc(${100 - b.part}% + 8px)` }
                                : { left: `calc(${b.part}% + 8px)` }
                            }
                            data-signal-groupe={signal ? 'echeance' : undefined}
                          >
                            <span className={`text-[12.5px] ${signal ? 'font-bold' : ''}`}>
                              {b.contrat.title}
                            </span>
                            <span className="tnum font-mono text-[10px] uppercase tracking-[0.14em]">
                              {dateCourte(b.contrat.endsAt)}
                            </span>
                          </span>
                        )}

                        {b.horsAxe && (
                          <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[11px] text-text-primary">
                            ›
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* LA GRADUATION — même boîte que les barres, donc mêmes repères. */}
              <div className="relative mt-2 h-4">
                {bornes.mois.map((m) => (
                  <span
                    key={m.cle}
                    className="absolute top-0 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-muted"
                    style={{ left: `${m.part}%` }}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Ce qui se décide sur ce contrat, et ce qui porte le récurrent ── */}
          {tete && (
            <motion.div variants={staggerItem} className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
              <section className="panel px-5 py-5">
                <p className="eyebrow mb-3">Ce qui se décide sur ce contrat</p>
                <p className="text-[26px] font-bold leading-[1.1] tracking-[-0.028em] text-text-primary">
                  {tete.party || t('contrats.sansPartie')}
                </p>
                <p className="mt-1.5 text-[14.5px] text-text-secondary">{tete.title}</p>

                <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
                  {[
                    { label: t('contrats.prochaineEcheance'), valeur: `J−${Math.max(0, joursAvant(tete.endsAt))}` },
                    { label: t('contrats.champ.montant'), valeur: tete.amountCents > 0 ? formatCents(tete.amountCents) : '—' },
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

                {/*
                  CE QUI TOMBE AVEC LUI. Les abonnements du même client ne sont
                  pas « liés » dans le modèle — il n'y a pas de clé étrangère
                  entre un contrat et un forfait. Le rapprochement se fait par
                  NOM de partie, et l'écran le dit plutôt que de laisser croire
                  à un lien qui n'existe pas.
                */}
                {tombentAvec.length > 0 && (
                  <p className="mt-5 border-t border-border-row pt-3 text-[13px] leading-relaxed text-text-secondary">
                    {tombentAvec.length} abonnement{tombentAvec.length > 1 ? 's' : ''} au nom de{' '}
                    {tete.party} {tombentAvec.length > 1 ? 'tombent' : 'tombe'} avec lui —{' '}
                    {formatCents(tombentAvec.reduce((n, a) => n + a.amountCents, 0))} par échéance.
                    Le rapprochement se fait par nom : le modèle ne lie pas un forfait à un contrat.
                  </p>
                )}
                {!tete.autoRenew && (
                  <p className="mt-3 text-[13px] leading-relaxed text-text-muted">
                    Reconduction non tacite : sans geste d’ici là, il s’arrête tout seul.
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
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
                </div>
              </section>

              {/* CE QUI PORTE LE RÉCURRENT — combien de contrats, quelle part. */}
              <section className="panel flex flex-col px-5 py-5">
                <p className="eyebrow mb-2">Ce qui porte le récurrent</p>
                <p className="tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                  {formatCents(valeur)}
                </p>
                <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                  sur {actifs.length} contrat{actifs.length > 1 ? 's' : ''} actif
                  {actifs.length > 1 ? 's' : ''}, {contrats.length} fiche
                  {contrats.length > 1 ? 's' : ''} au total.
                </p>
                <div className="mt-4 flex flex-col divide-y divide-border-row">
                  {lourds.map((c) => (
                    <div key={c.id} className="flex items-baseline justify-between gap-3 py-2">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                        {c.party || c.title}
                      </span>
                      <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-primary">
                        {formatCents(c.amountCents)}
                      </span>
                    </div>
                  ))}
                </div>
                {lourds.length > 0 && valeur > 0 && (
                  <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
                    Ces {lourds.length} contrats portent{' '}
                    {Math.round((lourds.reduce((n, c) => n + c.amountCents, 0) / valeur) * 100)} % du
                    récurrent.
                  </p>
                )}
              </section>
            </motion.div>
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

/* --------------------------------------------- la frise des fins (`14b`) -- */

/**
 * LA FRISE DES FINS — l'objet dominant de Contrats (`14b`).
 *
 * L'échéancier cesse d'être une colonne de dates triées : douze mois en
 * abscisse, une barre par contrat, dont la LONGUEUR est le temps qu'il lui
 * reste à courir. Les fins se voient arriver, et l'œil va d'abord à la barre
 * la plus courte — ce qu'aucune liste triée ne fait, parce qu'une liste triée
 * demande de lire avant de comprendre.
 *
 * TROIS RÈGLES, ET RIEN NE SORT JAMAIS DE L'AXE.
 *
 *   1. **Un contrat tacite n'a pas de fin.** Sa barre court jusqu'au bord en
 *      FONDU (`linear-gradient` vers transparent), sans cap et sans date
 *      posée hors axe, et porte « tacite · sans échéance » à l'intérieur.
 *      Lui donner un cap à douze mois inventerait une échéance qui n'existe
 *      pas, et quelqu'un finirait par la préparer.
 *   2. **Une barre assez longue porte son nom dedans** ; une barre trop
 *      courte le pose APRÈS son cap, avec sa date. Un nom gravé dans trois
 *      pixels n'est pas un nom.
 *   3. **Un contrat qui finit au-delà des douze mois** est borné au bord avec
 *      un chevron : c'est l'axe qui s'arrête, pas le contrat.
 */
const FRISE_LIGNE_H = 30;
/** En deçà, le nom ne tient pas dans la barre et se pose après le cap. */
const FRISE_NOM_MIN = 26;

interface BarreDeFrise {
  contrat: ContractData & { id: string };
  /** Part de l'axe occupée, de 0 à 100 — bornée, jamais au-delà. */
  part: number;
  jours: number;
  tacite: boolean;
  /** La fin tombe au-delà des douze mois de l'axe. */
  horsAxe: boolean;
  /** Le nom tient-il dans la barre ? */
  nomDedans: boolean;
}

/** Les bornes de l'axe : du 1er du mois courant, sur douze mois pleins. */
function bornesDeFrise(): { debut: Date; fin: Date; jours: number; mois: { cle: string; label: string; part: number }[] } {
  const debut = new Date();
  debut.setDate(1);
  debut.setHours(0, 0, 0, 0);
  const fin = new Date(debut);
  fin.setMonth(fin.getMonth() + 12);
  const jours = Math.round((fin.getTime() - debut.getTime()) / 86_400_000);
  const mois = Array.from({ length: 12 }, (_, i) => {
    const m = new Date(debut);
    m.setMonth(m.getMonth() + i);
    return {
      cle: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`,
      label: m.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''),
      part: (Math.round((m.getTime() - debut.getTime()) / 86_400_000) / jours) * 100,
    };
  });
  return { debut, fin, jours, mois };
}

function barresDeFrise(
  actifs: (ContractData & { id: string })[],
  bornes: ReturnType<typeof bornesDeFrise>,
): BarreDeFrise[] {
  const aujourdHui = new Date();
  aujourdHui.setHours(0, 0, 0, 0);
  return actifs
    .map((contrat) => {
      const tacite = !!contrat.autoRenew;
      const fin = new Date(`${contrat.endsAt}T00:00:00`);
      const reste = Math.max(0, Math.round((fin.getTime() - aujourdHui.getTime()) / 86_400_000));
      const depuisDebut = Math.round((fin.getTime() - bornes.debut.getTime()) / 86_400_000);
      const brut = (depuisDebut / bornes.jours) * 100;
      const part = tacite ? 100 : Math.max(1.5, Math.min(100, brut));
      return {
        contrat,
        part,
        jours: reste,
        tacite,
        horsAxe: !tacite && brut > 100,
        nomDedans: part >= FRISE_NOM_MIN,
      };
    })
    /* Les tacites en dernier : ils ne finissent pas, donc ils ne concourent
       pas pour « la barre la plus courte », qui est le sujet de l'objet. */
    .sort((a, b) => Number(a.tacite) - Number(b.tacite) || a.part - b.part);
}
