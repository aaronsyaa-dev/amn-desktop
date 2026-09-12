import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue, type CleTraduction } from '../i18n';

type Etat = 'ouvert' | 'enCours' | 'resolu';
interface TicketData {
  client: string;
  subject: string;
  note: string;
  status: Etat;
  openedAt: string;
  takenBy: string;
  resolvedAt: string | null;
}
type Ticket = TicketData & { id: string };
const jours = (depuis: string, jusqua: string | null) => Math.max(0, Math.round((Date.parse(jusqua ?? new Date().toISOString()) - Date.parse(depuis)) / 86_400_000));

/**
 * LES TRANCHES D'ÂGE — la seule division qui dise quelque chose ici.
 *
 * Un ticket tombe dans la première tranche dont il dépasse le plancher. Sept
 * jours est le seuil que l'écran signalait déjà en orange avant ce chantier :
 * il est repris tel quel plutôt que réinventé.
 */
const TRANCHES: Array<{ cle: CleTraduction; plancher: number }> = [
  { cle: 'sav.tranche.vieilles', plancher: 8 },
  { cle: 'sav.tranche.semaine', plancher: 1 },
  { cle: 'sav.tranche.jour', plancher: 0 },
];

/**
 * LE SAV — les demandes après vente, de l'ouverture à la résolution.
 *
 * Pour qui : un artisan, un installateur, une boutique dont un client rappelle
 * et personne ne sait qui avait promis quoi. Ce que ça règle : chaque
 * demande a un client, un état, et surtout un âge — ce qui traîne se voit.
 * Trois états seulement : ouverte, en cours, résolue. Un vrai ticketing a des
 * priorités, des files, des SLA ; ici on veut juste ne rien oublier.
 *
 * ## Ce qui domine : la plus vieille qui n'est pas réglée
 *
 * L'écran était un tableau à trois colonnes — ouverte, en cours, résolue —
 * et c'est précisément ce qui cachait l'âge. Sur le bac à sable, un store de
 * terrasse ouvert depuis trente-quatre jours que personne n'a pris et une
 * demande de devis d'il y a deux heures avaient la même carte, dans la même
 * colonne, l'âge écrit en mono 10 px. Le fichier disait pourtant déjà, en
 * tête : « chaque demande a un client, un état, et SURTOUT un âge ».
 *
 * L'état n'a d'ailleurs pas besoin d'une colonne : il tient en un mot sur la
 * ligne. L'âge, lui, ne se lit que si on range par lui.
 *
 * La plus vieille non réglée passe donc en tête, son âge en chiffre de titre.
 * Les autres se rangent par TRANCHES D'ÂGE — plus d'une semaine, cette
 * semaine, aujourd'hui — et non par état. Les réglées quittent la surface :
 * elles n'attendent rien, et se résument en une phrase avec leur délai moyen.
 *
 * ## L'ambre
 *
 * Sur la demande de tête, et sur le geste qu'elle réclame vraiment : PRENDRE
 * si personne ne l'a prise, RÉSOUDRE si quelqu'un l'a prise et qu'elle traîne
 * quand même. Une demande vieille et prise en charge n'est pas le même défaut
 * qu'une demande vieille dont personne ne s'est saisi, et l'écran ne dit donc
 * pas la même chose dans les deux cas.
 */
export function AfterSalesScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const { upsert, remove } = useSync();
  const brutes = useCollection<TicketData>('tickets');
  const [ouvert, setOuvert] = useState(false);
  const [client, setClient] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');

  /* Les non réglées, de la plus vieille à la plus fraîche : c'est l'ordre de
     tout l'écran, tête comprise. */
  const enSouffrance = useMemo(
    () => brutes.filter((tk) => tk.status !== 'resolu').sort((a, b) => a.openedAt.localeCompare(b.openedAt)),
    [brutes],
  );
  const reglees = useMemo(
    () => brutes.filter((tk) => tk.status === 'resolu').sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? '')),
    [brutes],
  );
  const tete = enSouffrance[0] ?? null;
  const suite = enSouffrance.slice(1);

  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const dusMois = reglees.filter((tk) => (tk.resolvedAt ?? '') >= debutMois);
  /* Le délai moyen, arrondi au jour : un dixième de jour ne veut rien dire sur
     une demande après vente. */
  const delaiMoyen = dusMois.length === 0 ? 0 : Math.round(dusMois.reduce((n, tk) => n + jours(tk.openedAt, tk.resolvedAt), 0) / dusMois.length);

  const ajouter = async () => {
    if (!subject.trim()) return;
    await upsert('tickets', uid('sav'), { client: client.trim(), subject: subject.trim(), note: note.trim(), status: 'ouvert', openedAt: new Date().toISOString(), takenBy: '', resolvedAt: null });
    setClient(''); setSubject(''); setNote(''); setOuvert(false);
  };
  const passer = (tk: Ticket, status: Etat) =>
    upsert('tickets', tk.id, {
      ...tk,
      status,
      takenBy: status === 'enCours' ? user?.email ?? tk.takenBy : tk.takenBy,
      resolvedAt: status === 'resolu' ? new Date().toISOString() : null,
    });
  const etat = (s: Etat) => t(`sav.etat.${s}` as CleTraduction);
  const ditLAge = (n: number) => (n === 0 ? t('sav.depuisAujourdhui') : n === 1 ? t('sav.depuisUn') : t('sav.depuis', { n }));
  const ditLeDelai = (n: number) => (n === 0 ? t('sav.resolueLeJourMeme') : n === 1 ? t('sav.resolueEnUn') : t('sav.resolueEn', { n }));
  const nomDe = (email: string) => (email ? profileFor(email).name : '');

  const ageTete = tete ? jours(tete.openedAt, null) : 0;
  const prise = tete ? tete.takenBy !== '' : false;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('sav.titre') })}
          title={t('sav.titre')}
          description={t('sav.description')}
          stats={[
            { label: t('sav.stat.ouvertes'), value: brutes.filter((tk) => tk.status === 'ouvert').length, emphasis: brutes.some((tk) => tk.status === 'ouvert') },
            { label: t('sav.stat.enCours'), value: brutes.filter((tk) => tk.status === 'enCours').length },
            { label: t('sav.stat.resoluesMois'), value: dusMois.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('sav.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('sav.champClient')} aria-label={t('sav.champClient')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('sav.champSujet')} aria-label={t('sav.champSujet')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sav.champNote')} aria-label={t('sav.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!subject.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('sav.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {brutes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('sav.vide.titre')} action={{ label: t('sav.vide.action'), onClick: () => setOuvert(true) }}>{t('sav.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {tete ? (
            <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="la-plus-vieille">
              <p className="eyebrow eyebrow-signal mb-3">
                {prise ? t('sav.priseParOuverte', { qui: nomDe(tete.takenBy) }) : t('sav.personneNaPrise')}
              </p>
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <h2 className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{tete.subject}</h2>
                  <p className="mt-1.5 text-sm text-text-secondary">{tete.client || '—'}</p>
                </div>
                {/* L'âge en chiffre de titre : c'est lui qui fait de cette demande
                    la première, et il doit se lire avant le reste. */}
                {ageTete === 0 ? (
                  <p className="text-sm text-text-secondary">{t('sav.ouverteAujourdhui')}</p>
                ) : (
                  <p className="flex items-baseline gap-2">
                    <span className={`text-[27px] font-semibold leading-none tabular-nums ${ageTete >= 8 ? 'text-warning' : 'text-text-primary'}`}>{ageTete}</span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{ageTete === 1 ? t('sav.jourOuverte') : t('sav.joursOuverte')}</span>
                  </p>
                )}
              </div>
              {tete.note && <p className="mt-3 text-sm leading-relaxed text-text-secondary">{tete.note}</p>}

              <div className="mt-5 flex flex-wrap gap-2">
                {!prise && (
                  <button type="button" onClick={() => void passer(tete, 'enCours')} className="signal-plate flex min-h-11 items-center gap-2 px-4 text-sm font-semibold md:min-h-0 md:py-2.5">
                    <UserCheck size={14} strokeWidth={2.5} /> {t('sav.prendre')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void passer(tete, 'resolu')}
                  className={
                    prise
                      ? 'signal-plate flex min-h-11 items-center gap-2 px-4 text-sm font-semibold md:min-h-0 md:py-2.5'
                      : 'flex min-h-11 items-center gap-2 border border-border-strong px-4 text-sm text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2.5'
                  }
                >
                  <Check size={14} strokeWidth={2} /> {t('sav.resoudre')}
                </button>
              </div>
            </motion.section>
          ) : (
            <motion.p variants={staggerItem} className="panel px-4 py-7 text-center text-sm text-text-secondary">{t('sav.rienDouvert')}</motion.p>
          )}

          {/* LES AUTRES, PAR TRANCHES D'ÂGE — jamais par état. */}
          {TRANCHES.map((tranche, i) => {
            const plafond = i === 0 ? Infinity : TRANCHES[i - 1].plancher - 1;
            const dedans = suite.filter((tk) => {
              const age = jours(tk.openedAt, null);
              return age >= tranche.plancher && age <= plafond;
            });
            if (dedans.length === 0) return null;
            return (
              <motion.section key={tranche.cle} variants={staggerItem} className="panel">
                <p className="eyebrow flex items-center justify-between border-b border-border px-4 py-2.5">
                  <span>{t(tranche.cle)}</span>
                  <span className="tnum">{dedans.length}</span>
                </p>
                <ul className="flex flex-col gap-px bg-border">
                  {dedans.map((tk) => {
                    const age = jours(tk.openedAt, null);
                    return (
                      <li key={tk.id} className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-2.5">
                        <span className="w-20 flex-shrink-0 font-mono text-[9px] uppercase tracking-wider text-text-muted">{etat(tk.status)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="text-sm text-text-primary">{tk.subject}</span>
                          {tk.client && <span className="text-sm text-text-muted"> · {tk.client}</span>}
                        </span>
                        <span className={`font-mono text-[10px] uppercase tracking-wider ${age >= 8 ? 'text-warning' : 'text-text-muted'}`}>
                          {ditLAge(age)}
                          {tk.takenBy && <span className="text-text-muted"> · {t('sav.parQui', { qui: nomDe(tk.takenBy) })}</span>}
                        </span>
                        <span className="flex flex-shrink-0 gap-2">
                          {tk.status === 'ouvert' && (
                            <button type="button" onClick={() => void passer(tk, 'enCours')} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1"><UserCheck size={11} /> {t('sav.prendre')}</button>
                          )}
                          <button type="button" onClick={() => void passer(tk, 'resolu')} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1"><Check size={11} /> {t('sav.resoudre')}</button>
                          <button type="button" onClick={() => void remove('tickets', tk.id)} aria-label={t('sav.supprimer')} title={t('sav.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </motion.section>
            );
          })}

          {/* LES RÉGLÉES — une phrase, puis un registre en sourdine. Elles
              n'attendent rien : elles ne prennent plus le tiers de l'écran. */}
          {reglees.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
                <p className="eyebrow">{t('sav.reglees')}</p>
                <p className="text-[11px] text-text-secondary">
                  {dusMois.length === 0
                    ? t('sav.bilanMoisAucune')
                    : dusMois.length === 1
                      ? t('sav.bilanMoisUne', { moyenne: delaiMoyen })
                      : t('sav.bilanMois', { n: dusMois.length, moyenne: delaiMoyen })}
                </p>
              </div>
              <ul className="flex flex-col gap-px bg-border">
                {reglees.slice(0, 8).map((tk) => (
                  <li key={tk.id} className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-surface px-4 py-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-text-secondary">
                      {tk.subject}
                      {tk.client && <span className="text-text-muted"> · {tk.client}</span>}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{ditLeDelai(jours(tk.openedAt, tk.resolvedAt))}</span>
                    <button type="button" onClick={() => void passer(tk, 'ouvert')} className="flex min-h-11 items-center gap-1 px-1 text-[11px] text-text-muted opacity-0 hover:text-text-primary focus:opacity-100 group-hover:opacity-100 md:min-h-0"><RotateCcw size={11} /> {t('sav.rouvrir')}</button>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}
        </>
      )}
    </motion.section>
  );
}
