import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { formatCents, formatCentsCompact } from '../lib/money';
import { useInvoices, invoiceTotals } from '../state/useInvoices';
import { useHaloSignal } from '../components/EtatEcran';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface CashCountData {
  day: string;
  floatCents: number;
  expectedCents: number;
  countedCents: number;
  note: string;
  byEmail: string;
  countedAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const centimes = (s: string) => Math.round((Number(String(s).trim().replace(',', '.')) || 0) * 100);
const ecartDe = (c: CashCountData) => c.countedCents - (c.floatCents + c.expectedCents);

/**
 * LA CAISSE DU JOUR — le fond, les espèces comptées, l'écart.
 *
 * Pour qui : une boutique qui compte sa caisse le soir sur un coin de
 * comptoir et perd le papier. Ce que ça règle : trois montants par jour —
 * le fond de caisse du matin, les ventes en espèces attendues (le ticket
 * de la caisse enregistreuse), ce qui est réellement compté — et l'écart
 * qui en découle, gardé jour après jour. Un écart n'est pas une faute : c'est
 * un chiffre qu'on voit, au lieu de le découvrir en fin de mois.
 */
export function CashCountScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<CashCountData>('cashCounts');
  const aujourdhui = isoJour(new Date());
  const duJour = brutes.find((c) => c.day === aujourdhui) ?? null;
  const [floatEuros, setFloatEuros] = useState<string | null>(null);
  const [expected, setExpected] = useState<string | null>(null);
  const [counted, setCounted] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gardee, setGardee] = useState(false);

  const passes = useMemo(() => brutes.filter((c) => c.day !== aujourdhui).sort((a, b) => b.day.localeCompare(a.day)), [brutes, aujourdhui]);
  const trente = isoJour(new Date(Date.now() - 30 * 86_400_000));
  const recents = brutes.filter((c) => c.day >= trente);
  const cumul = recents.reduce((n, c) => n + ecartDe(c), 0);
  const dernierFond = passes[0]?.floatCents ?? 0;
  const vFloat = floatEuros ?? (duJour ? String(duJour.floatCents / 100) : dernierFond ? String(dernierFond / 100) : '');
  const vExpected = expected ?? (duJour ? String(duJour.expectedCents / 100) : '');
  const vCounted = counted ?? (duJour ? String(duJour.countedCents / 100) : '');
  const ecartCourant = vCounted.trim() === '' ? null : centimes(vCounted) - (centimes(vFloat) + centimes(vExpected));

  const garder = async () => {
    if (vCounted.trim() === '') return;
    await upsert('cashCounts', `caisse-${aujourdhui}`, { day: aujourdhui, floatCents: centimes(vFloat), expectedCents: centimes(vExpected), countedCents: centimes(vCounted), note: (note ?? duJour?.note ?? '').trim(), byEmail: user?.email ?? '', countedAt: new Date().toISOString() });
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2000);
  };
  const ecartTexte = (n: number) => `${n > 0 ? '+' : ''}${formatCents(n)}`;

  /* ---------------------------------------------- les deux instruments -- */

  const parJour = useMemo(() => new Map(brutes.map((c) => [c.day, c])), [brutes]);

  const jours = useMemo<JourDeCaisse[]>(() => {
    const liste: JourDeCaisse[] = [];
    for (let i = JOURS_CAISSE - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const cle = isoJour(d);
      const compte = parJour.get(cle);
      liste.push({
        jour: cle,
        libelle: String(d.getDate()),
        /* PAS DE BARRE SANS CAISSE COMPTÉE. `null`, pas zéro : zéro voudrait
           dire « rien encaissé », ce qui est une autre information. */
        reelCents: compte ? compte.expectedCents : null,
        courant: cle === aujourdhui,
      });
    }
    return liste;
  }, [parJour, aujourdhui]);

  /* L'habituelle se calcule sur les jours PASSÉS : inclure celui d'aujourd'hui
     ferait bouger le repère avec la mesure qu'il sert à juger. */
  const habituelCents = useMemo(
    () => journeeHabituelle(brutes.filter((c) => c.day < aujourdhui).map((c) => c.expectedCents)),
    [brutes, aujourdhui],
  );
  const duJourCents = duJour ? duJour.expectedCents : centimes(vExpected);
  const partDeLHabituel = habituelCents > 0 ? duJourCents / habituelCents : 0;
  const haut = Math.max(habituelCents, ...jours.map((j) => j.reelCents ?? 0), 1);

  /* L'ambre va au jour courant, et à lui seul — sa colonne et sa graduation
     sous l'axe sont le MÊME objet, d'où le groupe qui les compte pour un. */
  /*
    LA RESPIRATION, PAS LA LUEUR. `MODULES.md` demande ici le mouvement à
    2,8 s — `dvamber`, une respiration d'opacité — et non le halo de 3,6 s des
    objets dominants ambre. `useHaloSignal` sert de garde : il rend la chaîne
    vide sur un écran vide, donc une journée sans encaissement ne respire pas.
  */
  const souffle = useHaloSignal(duJourCents > 0) ? 'souffle-signal' : '';

  /* Les moyens de paiement, sur le mois en cours : une seule journée laisse
     trop souvent une barre vide, et une barre vide ne dit rien du mélange. */
  const { invoices } = useInvoices();
  const moisCourant = aujourdhui.slice(0, 7);
  const encaissements = useMemo(
    () =>
      invoices
        .filter((inv) => inv.status === 'paid' && inv.paidAt.startsWith(moisCourant))
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [invoices, moisCourant],
  );
  const parMoyen = useMemo(() => {
    const totaux = new Map<string, { cents: number; nombre: number }>();
    for (const inv of encaissements) {
      const cle = classerMoyen(inv.paymentMethod);
      const e = totaux.get(cle) ?? { cents: 0, nombre: 0 };
      e.cents += invoiceTotals(inv).grossCents;
      e.nombre += 1;
      totaux.set(cle, e);
    }
    return totaux;
  }, [encaissements]);
  const totalEncaisse = useMemo(
    () => [...parMoyen.values()].reduce((n, e) => n + e.cents, 0),
    [parMoyen],
  );
  /* Le fond attendu à la clôture SE CALCULE : ouverture + espèces encaissées.
     C'est la seule des trois lignes du formulaire qui n'est pas une saisie. */
  const fondAttenduCents = centimes(vFloat) + centimes(vExpected);

  const champ = 'input-focus tnum min-h-11 w-full border border-border bg-bg px-3 text-right text-sm text-text-primary outline-none';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('caisse.titre') })}
          title={t('caisse.titre')}
          description={t('caisse.description')}
          stats={[
            { label: t('caisse.stat.ecartJour'), value: duJour ? ecartTexte(ecartDe(duJour)) : '—', emphasis: Boolean(duJour && ecartDe(duJour) !== 0) },
            { label: t('caisse.stat.jours'), value: recents.length },
            { label: t('caisse.stat.cumul'), value: recents.length ? ecartTexte(cumul) : '—', emphasis: cumul !== 0 },
          ]}
        />
      </motion.div>

      {/* ------------------------------------------- les deux instruments -- */}
      {brutes.length > 0 && (
        <motion.section variants={staggerItem} className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="eyebrow">
              La journée · {habituelCents > 0 ? `habituelle ${formatCentsCompact(habituelCents)}` : 'pas encore d’habitude'}
            </p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
              le fantôme est la journée habituelle
            </p>
          </div>

          <div className="flex flex-col gap-8 sm:flex-row sm:items-end">
            {/* LA COLONNE — une caisse se lit à la verticale. */}
            <div className="flex flex-shrink-0 items-end gap-2">
              <div className="relative" style={{ height: CAISSE_H, width: 34 }}>
                {CRANS_CAISSE.map((c) => (
                  <span
                    key={c}
                    className="absolute right-0 -translate-y-1/2 font-mono text-[9px] uppercase tracking-[0.1em] text-text-muted"
                    style={{ bottom: `${c}%` }}
                  >
                    {c} %
                  </span>
                ))}
              </div>
              <div
                className="relative border border-border bg-sunken"
                style={{ width: COLONNE_CAISSE_L, height: CAISSE_H }}
              >
                {CRANS_CAISSE.slice(1, -1).map((c) => (
                  <span
                    key={c}
                    aria-hidden
                    className="absolute inset-x-0 h-px bg-border"
                    style={{ bottom: `${c}%` }}
                  />
                ))}
                {/*
                  LA COLONNE NE BOUGE PAS ET N'EST PAS AMBRE.

                  Elle portait la lueur de signal, et l'écran avait donc DEUX
                  régions ambre — vu sur capture, pas à la relecture. Ce que
                  `MODULES.md` fait bouger, c'est « la colonne d'encaissement
                  de l'heure en cours » DANS L'HISTOGRAMME, et c'est elle qui
                  porte l'ambre. La colonne verticale est un état : elle dit
                  où en est la journée, elle ne demande rien.
                */}
                <span
                  className="absolute inset-x-0 bottom-0 block bg-[#4a4a48]"
                  style={{ height: `${Math.min(100, partDeLHabituel * 100)}%` }}
                />
              </div>
              <div className="pb-1">
                <p className="tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                  {habituelCents > 0 ? `${Math.round(partDeLHabituel * 100)} %` : '—'}
                </p>
                <p className="eyebrow mt-2">de la journée habituelle</p>
                {/* LE MONTANT RAPPELÉ RESTE EN ENCRE CLAIRE : c'est la même
                    donnée que la colonne, pas un second sujet. */}
                <p className="tnum mt-3 font-mono text-[13px] text-text-secondary">
                  {formatCents(duJourCents)} aujourd’hui
                </p>
              </div>
            </div>

            {/* LES QUATORZE JOURS — chacun avec le fantôme de l'habituelle. */}
            <div className="min-w-0 flex-1">
              <div className="flex items-end gap-1.5" style={{ height: CAISSE_H }}>
                {jours.map((j) => {
                  const signal = j.courant && (j.reelCents ?? 0) > 0;
                  return (
                    <div
                      key={j.jour}
                      className="relative flex h-full flex-1 items-end"
                      title={`${j.jour} · ${j.reelCents === null ? 'caisse non comptée' : formatCents(j.reelCents)}`}
                    >
                      {/* LE FANTÔME, toujours dessiné. */}
                      {habituelCents > 0 && (
                        <span
                          aria-hidden
                          className="absolute inset-x-0 bottom-0 border border-dashed border-border-strong"
                          style={{ height: `${(habituelCents / haut) * 100}%` }}
                        />
                      )}
                      {/* LA BARRE RÉELLE — absente si la caisse n'a pas été
                          comptée, et cette absence EST l'information. */}
                      {j.reelCents !== null && (
                        <span
                          className={`relative block w-full ${signal ? `bg-signal ${souffle}` : 'bg-[#2b2b2b]'}`}
                          style={{ height: `${Math.max(2, (j.reelCents / haut) * 100)}%` }}
                          data-signal-groupe={signal ? 'jour-courant' : undefined}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              {/* LA GRADUATION — même rangée de colonnes que les barres. La
                  graduation du jour courant et sa barre sont le MÊME objet. */}
              <div className="mt-1.5 flex gap-1.5">
                {jours.map((j) => {
                  const signal = j.courant && (j.reelCents ?? 0) > 0;
                  return (
                    <span
                      key={j.jour}
                      className={`flex-1 text-center font-mono text-[9.5px] tracking-[0.1em] ${
                        signal ? 'font-bold text-signal' : j.courant ? 'text-text-primary' : 'text-text-muted'
                      }`}
                      data-signal-groupe={signal ? 'jour-courant' : undefined}
                    >
                      {j.libelle}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="mt-6 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
            Un jour sans barre est un jour dont la caisse n’a pas été comptée — pas un jour à zéro.
            L’axe est en JOURS et non en heures : la caisse se saisit une fois, au comptoir, et une
            facture encaissée porte un jour sans heure. Répartir un total quotidien sur douze heures
            donnerait une courbe qui a l’air d’une mesure sans en être une.
          </p>
        </motion.section>
      )}

      {/* ----------------------- les moyens de paiement et la clôture ------ */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        <motion.section variants={staggerItem} className="panel px-5 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="eyebrow">Moyens de paiement · mois en cours</p>
            <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
              {formatCents(totalEncaisse)}
            </p>
          </div>
          {totalEncaisse === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Rien d’encaissé ce mois-ci : la barre attend son premier règlement.
            </p>
          ) : (
            <>
              <div className="flex w-full overflow-hidden" style={{ height: 34 }} aria-hidden>
                {MOYENS.map((m) => {
                  const e = parMoyen.get(m.cle);
                  if (!e) return null;
                  return (
                    <span
                      key={m.cle}
                      style={{ width: `${(e.cents / totalEncaisse) * 100}%`, background: m.teinte }}
                    />
                  );
                })}
                {parMoyen.get('autre') && (
                  <span
                    style={{
                      width: `${((parMoyen.get('autre')?.cents ?? 0) / totalEncaisse) * 100}%`,
                      background: 'var(--color-border)',
                    }}
                  />
                )}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {MOYENS.map((m) => {
                  const e = parMoyen.get(m.cle) ?? { cents: 0, nombre: 0 };
                  return (
                    <div key={m.cle}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="h-2 w-2 flex-shrink-0" style={{ background: m.teinte }} aria-hidden />
                        <span className="eyebrow">{m.label}</span>
                      </div>
                      <p className="tnum font-mono text-[17px] font-semibold tracking-[-0.03em] text-text-primary">
                        {formatCentsCompact(e.cents)}
                      </p>
                      <p className="tnum mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                        {e.nombre} règlement{e.nombre > 1 ? 's' : ''} ·{' '}
                        {Math.round((e.cents / totalEncaisse) * 100)} %
                      </p>
                    </div>
                  );
                })}
              </div>
              {parMoyen.get('autre') && (
                <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {formatCents(parMoyen.get('autre')?.cents ?? 0)} sous un libellé que le
                  regroupement ne reconnaît pas — le moyen de règlement est un champ libre sur la
                  facture, et ce reste est ce qui n’entre dans aucune des trois classes.
                </p>
              )}
            </>
          )}
        </motion.section>

        <motion.section variants={staggerItem} className="panel flex flex-col px-5 py-4">
          <p className="eyebrow mb-2">Fond attendu à la clôture</p>
          <p className="tnum font-mono text-[27px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
            {formatCents(fondAttenduCents)}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
            Ouverture {formatCents(centimes(vFloat))} + espèces encaissées{' '}
            {formatCents(centimes(vExpected))}. C’est la seule des trois lignes du formulaire qui ne
            se saisit pas : elle se calcule.
          </p>

          <p className="eyebrow mb-2 mt-5">Derniers encaissements</p>
          {encaissements.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">Rien ce mois-ci.</p>
          ) : (
            <div className="flex flex-col divide-y divide-border-row">
              {encaissements.slice(0, 4).map((inv) => {
                const cle = classerMoyen(inv.paymentMethod);
                const m = MOYENS.find((x) => x.cle === cle);
                return (
                  <div key={inv.id} className="flex items-center gap-3 py-2">
                    <span
                      className="h-6 w-0.5 flex-shrink-0"
                      style={{ background: m?.teinte ?? 'var(--color-border)' }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] text-text-secondary">
                        {inv.billTo.company || inv.billTo.name || 'Sans client'}
                      </span>
                      <span className="tnum block truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                        {inv.paidAt} · {inv.paymentMethod || 'moyen non noté'}
                      </span>
                    </span>
                    <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-primary">
                      {formatCentsCompact(invoiceTotals(inv).grossCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.section>
      </div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void garder(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champFond')}<input value={vFloat} onChange={(e) => setFloatEuros(e.target.value)} inputMode="decimal" className={champ} /></label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champAttendu')}<input value={vExpected} onChange={(e) => setExpected(e.target.value)} inputMode="decimal" className={champ} /></label>
        <label className="flex flex-col gap-1 text-xs text-text-muted">{t('caisse.champCompte')}<input value={vCounted} onChange={(e) => setCounted(e.target.value)} inputMode="decimal" className={champ} /></label>
        <input value={note ?? duJour?.note ?? ''} onChange={(e) => setNote(e.target.value)} placeholder={t('caisse.champNote')} aria-label={t('caisse.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
        <div className="flex items-center justify-between gap-3">
          <p className={`tnum text-lg font-medium ${ecartCourant === null ? 'text-text-muted' : ecartCourant === 0 ? 'text-success' : 'text-warning'}`}>{ecartCourant === null ? t('caisse.ecart') : `${t('caisse.ecart')} ${ecartTexte(ecartCourant)}`}</p>
          <button type="submit" disabled={vCounted.trim() === ''} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">{gardee ? <Check size={14} /> : null} {gardee ? t('caisse.gardee') : t('caisse.garder')}</button>
        </div>
      </motion.form>

      {brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('caisse.vide.titre')}>{t('caisse.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        passes.length > 0 && (
          <motion.div variants={staggerItem} className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead><tr>{[t('caisse.colonne.jour'), t('caisse.champFond'), t('caisse.champAttendu'), t('caisse.champCompte'), t('caisse.ecart'), ''].map((h, i) => <th key={i} scope="col" className="eyebrow p-2 text-left">{h}</th>)}</tr></thead>
              <tbody>
                {passes.map((c) => (
                  <tr key={c.day} className="group border-t border-border">
                    <th scope="row" className="p-2 text-left font-medium text-text-primary">{c.day}{c.note && <span className="block text-xs font-normal text-text-muted">{c.note}</span>}</th>
                    <td className="tnum p-2 text-text-secondary">{formatCents(c.floatCents)}</td>
                    <td className="tnum p-2 text-text-secondary">{formatCents(c.expectedCents)}</td>
                    <td className="tnum p-2 text-text-primary">{formatCents(c.countedCents)}</td>
                    <td className={`tnum p-2 ${ecartDe(c) === 0 ? 'text-success' : 'text-warning'}`}>{ecartTexte(ecartDe(c))}</td>
                    <td className="p-2">
                      <button
                        type="button"
                        onClick={() => void remove('cashCounts', c.id)}
                        aria-label={t('caisse.supprimer')}
                        title={t('caisse.supprimer')}
                        className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )
      )}
    </motion.section>
  );
}

/* ------------------------------------------- les deux instruments (`11c`) -- */

/**
 * LA CAISSE SE LIT À LA VERTICALE — l'objet dominant de Caisse du jour (`11c`).
 *
 * ════════════════════════════════════════════════════════════════════════
 * ARBITRAGE : L'AXE EST EN JOURS, PAS EN HEURES. LE PRODUIT A RAISON.
 * ════════════════════════════════════════════════════════════════════════
 *
 * `MODULES.md` décrit, à droite de la colonne, « l'heure par heure en
 * histogramme, chaque heure portant le fantôme de la journée habituelle ».
 * Le produit ne peut pas le faire, et il a raison de ne pas pouvoir :
 *
 *   • une caisse du jour se saisit UNE FOIS, au comptoir, le soir : trois
 *     montants (`floatCents`, `expectedCents`, `countedCents`). Il n'y a pas
 *     de caisse enregistreuse branchée, donc pas d'heure d'encaissement ;
 *   • les factures encaissées portent `paidAt`, qui est un JOUR (`isoDay()`),
 *     sans heure — c'est un choix du modèle, et il est juste : personne ne
 *     note l'heure à laquelle un virement est arrivé ;
 *   • répartir un total quotidien sur douze heures produirait une courbe
 *     qui a l'air d'une mesure sans en être une. C'est exactement ce que les
 *     règles de l'ambre et des zéros existent pour empêcher : un écran ne
 *     montre pas un chiffre qu'il n'a pas.
 *
 * L'INSTRUMENT EST DONC GARDÉ TEL QUEL, sur la granularité que le produit
 * possède : quatorze JOURS, chacun portant le fantôme de la journée
 * habituelle derrière sa barre réelle. La question que l'objet pose ne change
 * pas — « suis-je devant ou derrière l'ordinaire ? » — seule son échelle
 * change, et elle est vraie.
 *
 * La règle « ce qui n'a pas encore eu lieu n'a QUE son fantôme » est tenue au
 * mot : un jour sans caisse comptée n'a pas de barre, et l'absence de barre
 * est l'information.
 */
const COLONNE_CAISSE_L = 52;
const CAISSE_H = 280;
const JOURS_CAISSE = 14;
/** Les graduations de la colonne, en quarts de journée habituelle. */
const CRANS_CAISSE = [0, 25, 50, 75, 100];

interface JourDeCaisse {
  jour: string;
  libelle: string;
  /** Espèces encaissées ce jour-là — null si la caisse n'a pas été comptée. */
  reelCents: number | null;
  courant: boolean;
}

/**
 * La journée habituelle : la MÉDIANE des jours comptés, pas la moyenne.
 *
 * Une seule journée exceptionnelle — un marché de Noël, une fermeture —
 * déplace une moyenne de plusieurs dizaines d'euros et fausse le fantôme de
 * tous les autres jours. La médiane ne bouge pas pour un jour sur quinze, et
 * c'est bien ce qu'on veut dire par « habituelle ».
 */
function journeeHabituelle(valeurs: number[]): number {
  const tries = valeurs.filter((v) => v > 0).sort((a, b) => a - b);
  if (tries.length === 0) return 0;
  const milieu = Math.floor(tries.length / 2);
  return tries.length % 2 === 1 ? tries[milieu] : Math.round((tries[milieu - 1] + tries[milieu]) / 2);
}

/**
 * LES MOYENS DE PAIEMENT.
 *
 * `Invoice.paymentMethod` est un champ LIBRE : on y tape « CB », « carte
 * bleue », « Espèces », « virement SEPA ». Le regroupement normalise donc
 * (minuscules, accents retirés) et range par mot-clé, avec une classe
 * « autre » qui ramasse ce qui n'entre nulle part — plutôt qu'un quatrième
 * moyen inventé pour chaque orthographe. C'est fragile par nature, et c'est
 * dit ici pour que personne ne le découvre en lisant un total faux.
 */
const MOYENS = [
  { cle: 'carte', label: 'Carte', mots: ['carte', 'cb', 'bleue', 'tpe'], teinte: '#4a4a48' },
  { cle: 'especes', label: 'Espèces', mots: ['espece', 'liquide', 'cash'], teinte: 'var(--color-border-strong)' },
  { cle: 'virement', label: 'Virement', mots: ['virement', 'sepa', 'transfert'], teinte: '#2b2b2b' },
] as const;

function classerMoyen(brut: string): string {
  const net = brut
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  for (const m of MOYENS) if (m.mots.some((mot) => net.includes(mot))) return m.cle;
  return 'autre';
}
