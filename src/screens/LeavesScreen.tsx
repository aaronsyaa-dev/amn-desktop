import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarOff, Check, Plus, X } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { UserAvatar } from '../components/UserAvatar';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type LeaveKind = 'conge' | 'maladie' | 'teletravail' | 'autre';
type LeaveStatus = 'pending' | 'approved' | 'declined';
interface LeaveData {
  email: string;
  from: string;
  to: string;
  kind: LeaveKind;
  note: string;
  status: LeaveStatus;
  decidedBy: string | null;
  createdAt: string;
}
const KINDS: LeaveKind[] = ['conge', 'maladie', 'teletravail', 'autre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * LES ABSENCES — congés, maladie, télétravail, et qui est là aujourd'hui.
 *
 * Pour qui : une équipe où l'absence se dit à l'oral et se découvre le jour
 * même. Ce que ça règle : une demande datée, validée par qui gère, lisible
 * par tous ; et en haut, la seule question du matin — « qui est absent
 * aujourd'hui ? ». Pas de compteur de jours acquis : ce serait une paie, et
 * ce n'en est pas une.
 */
export function LeavesScreen() {
  const { t, langue } = useLangue();
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
  const { profileFor } = useProfiles();
  const brutes = useCollection<LeaveData>('leaves');
  const [ouvert, setOuvert] = useState(false);
  const [kind, setKind] = useState<LeaveKind>('conge');
  const [from, setFrom] = useState(aujourdhui());
  const [to, setTo] = useState(aujourdhui());
  const [note, setNote] = useState('');
  const moi = user?.email ?? '';
  const admin = isAdminRole(role);
  const jour = aujourdhui();

  const absences = useMemo(() => [...brutes].sort((a, b) => a.from.localeCompare(b.from)), [brutes]);
  const absentsAujourdhui = absences.filter((a) => a.status === 'approved' && a.from <= jour && a.to >= jour);
  const enAttente = absences.filter((a) => a.status === 'pending');
  const aVenir = absences.filter((a) => a.status === 'approved' && a.to >= jour);
  const passees = absences.filter((a) => a.status !== 'pending' && a.to < jour);

  const libelleKind = (k: LeaveKind) => t(`absences.type.${k}` as Parameters<typeof t>[0]);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const dates = (a: LeaveData) => {
    const f = new Date(`${a.from}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    const d = new Date(`${a.to}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
    return a.from === a.to ? f : `${f} → ${d}`;
  };

  const demander = async () => {
    if (!moi || !from || !to || to < from) return;
    await upsert('leaves', uid('leave'), { email: moi, from, to, kind, note: note.trim(), status: admin ? 'approved' : 'pending', decidedBy: admin ? moi : null, createdAt: new Date().toISOString() });
    setNote('');
    setOuvert(false);
  };
  const decider = (a: LeaveData & { id: string }, status: LeaveStatus) => upsert('leaves', a.id, { ...a, status, decidedBy: moi });

  const Ligne = ({ a }: { a: LeaveData & { id: string } }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 bg-surface px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <UserAvatar email={a.email} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm text-text-primary">
            {profileFor(a.email).name} <span className="text-text-muted">· {libelleKind(a.kind)}</span>
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {dates(a)}
            {a.note && <span className="normal-case tracking-normal"> · {a.note}</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1.5">
        <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${a.status === 'approved' ? 'border-success/40 text-success' : a.status === 'declined' ? 'border-border text-text-muted' : 'border-warning/40 text-warning'}`}>
          {t(`absences.statut.${a.status}` as Parameters<typeof t>[0])}
        </span>
        {a.status === 'pending' && admin && a.email !== moi && (
          <>
            <button type="button" onClick={() => void decider(a, 'approved')} className="flex min-h-11 items-center gap-1 border border-border-strong px-2.5 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"><Check size={12} /> {t('absences.valider')}</button>
            <button type="button" onClick={() => void decider(a, 'declined')} className="flex min-h-11 items-center gap-1 border border-border px-2.5 text-xs text-text-muted hover:text-text-primary md:min-h-0 md:py-1.5"><X size={12} /> {t('absences.refuser')}</button>
          </>
        )}
        {(a.email === moi || admin) && a.status !== 'approved' && (
          <button type="button" onClick={() => void remove('leaves', a.id)} className="border border-border px-2.5 py-1.5 text-xs text-text-muted hover:text-danger">{t('absences.retirer')}</button>
        )}
      </div>
    </li>
  );

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('collectif.surtitre', { module: t('absences.titre') })}
          title={t('absences.titre')}
          description={absentsAujourdhui.length > 0 ? t('absences.aujourdhui', { noms: absentsAujourdhui.map((a) => profileFor(a.email).name).join(', ') }) : t('absences.toutLeMonde')}
          stats={[
            { label: t('absences.stat.absents'), value: absentsAujourdhui.length, emphasis: absentsAujourdhui.length > 0 },
            { label: t('absences.stat.aValider'), value: enAttente.length, emphasis: admin && enAttente.length > 0 },
            { label: t('absences.stat.aVenir'), value: aVenir.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('absences.demander')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void demander(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champType')}
              <select value={kind} onChange={(e) => setKind(e.target.value as LeaveKind)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {KINDS.map((k) => <option key={k} value={k}>{libelleKind(k)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champDu')}
              <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (to < e.target.value) setTo(e.target.value); }} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('absences.champAu')}
              <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('absences.champNote')} aria-label={t('absences.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{admin ? t('absences.enregistrer') : t('absences.envoyer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {absences.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('absences.vide.titre')} action={{ label: t('absences.vide.action'), onClick: () => setOuvert(true) }}>{t('absences.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="flex flex-col gap-5">
          {[
            [t('absences.groupe.aValider'), enAttente],
            [t('absences.groupe.aVenir'), aVenir],
            [t('absences.groupe.passees'), passees],
          ].map(([titre, liste]) =>
            (liste as (LeaveData & { id: string })[]).length > 0 ? (
              <section key={String(titre)}>
                <p className="eyebrow mb-2 flex items-center gap-2"><CalendarOff size={12} /> {String(titre)} · {(liste as unknown[]).length}</p>
                <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
                  {(liste as (LeaveData & { id: string })[]).map((a) => <Ligne key={a.id} a={a} />)}
                </ul>
              </section>
            ) : null,
          )}
        </motion.div>
      )}
    </motion.section>
  );
}
