import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Poste = 'matin' | 'apresmidi' | 'journee' | 'repos';
interface ShiftData {
  email: string;
  day: string;
  kind: Poste;
  updatedAt: string;
}
const CYCLE: (Poste | null)[] = ['matin', 'apresmidi', 'journee', 'repos', null];
const JOUR = 86_400_000;

const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Le lundi de la semaine de `d`, à minuit local. */
function lundi(d: Date): Date {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const decalage = (j.getDay() + 6) % 7;
  j.setDate(j.getDate() - decalage);
  return j;
}
const nomCourt = (email: string) => email.split('@')[0].replace(/[._-]+/g, ' ');

/**
 * LE PLANNING D'ÉQUIPE — qui est là quel jour.
 *
 * Pour qui : une boutique ou un atelier à plusieurs, où « qui ouvre jeudi ? »
 * se règle par SMS. Ce que ça règle : une grille membres × jours, une case
 * par clic qui tourne entre matin, après-midi, journée et repos. Les
 * membres viennent de l'organisation elle-même : pas de liste à tenir à
 * côté. Les absences validées restent dans Absences ; ici c'est le planning
 * voulu, pas les imprévus.
 */
export function ShiftsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const navigate = useNavigate();
  const { upsert, remove } = useSync();
  const { membres } = useMembers();
  const brutes = useCollection<ShiftData>('shifts');
  const [semaine, setSemaine] = useState(0);

  const debut = useMemo(() => {
    const l = lundi(new Date());
    l.setDate(l.getDate() + semaine * 7);
    return l;
  }, [semaine]);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(debut.getTime() + i * JOUR)), [debut]);
  const actifs = useMemo(() => membres.filter((m) => m.status === 'active').sort((a, b) => a.email.localeCompare(b.email)), [membres]);
  const parCase = useMemo(() => {
    const m = new Map<string, ShiftData & { id: string }>();
    for (const s of brutes) m.set(`${s.email}|${s.day}`, s);
    return m;
  }, [brutes]);
  const aujourdhui = isoJour(new Date());
  const presents = actifs.filter((m) => { const k = parCase.get(`${m.email}|${aujourdhui}`)?.kind; return k && k !== 'repos'; }).length;
  const posees = jours.reduce((n, j) => n + actifs.filter((m) => parCase.has(`${m.email}|${isoJour(j)}`)).length, 0);

  const tourner = async (email: string, day: string) => {
    const actuel = parCase.get(`${email}|${day}`);
    const suivant = CYCLE[(CYCLE.indexOf(actuel?.kind ?? null) + 1) % CYCLE.length];
    if (!suivant) {
      if (actuel) await remove('shifts', actuel.id);
      return;
    }
    await upsert('shifts', actuel?.id ?? `shift-${email}-${day}`, { email, day, kind: suivant, updatedAt: new Date().toISOString() });
  };
  const poste = (k: Poste) => t(`planning.kind.${k}` as Parameters<typeof t>[0]);
  const dateCourte = (d: Date) => d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });
  const teinte: Record<Poste, string> = {
    matin: 'bg-accent/15 text-text-primary border-accent/40',
    apresmidi: 'bg-accent/10 text-text-primary border-accent/30',
    journee: 'bg-accent/25 text-text-primary border-accent/60',
    repos: 'bg-bg text-text-muted border-border',
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('planning.titre') })}
          title={t('planning.titre')}
          description={t('planning.description')}
          stats={[
            { label: t('planning.stat.presents'), value: presents },
            { label: t('planning.stat.cases'), value: posees },
            { label: t('planning.stat.membres'), value: actifs.length },
          ]}
          actions={
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setSemaine((s) => s - 1)} aria-label={t('planning.semainePrecedente')} title={t('planning.semainePrecedente')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setSemaine(0)} className="min-h-11 border border-border px-3 text-sm text-text-primary hover:bg-surface-hover">
                {semaine === 0 ? t('planning.cetteSemaine') : t('planning.semaineDu', { date: debut.toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })}
              </button>
              <button type="button" onClick={() => setSemaine((s) => s + 1)} aria-label={t('planning.semaineSuivante')} title={t('planning.semaineSuivante')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><ChevronRight size={16} /></button>
            </div>
          }
        />
      </motion.div>

      {actifs.length <= 1 && brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('planning.vide.titre')} action={{ label: t('planning.vide.action'), onClick: () => navigate('/membres') }}>{t('planning.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr>
                <th scope="col" className="eyebrow p-3 text-left">{t('planning.stat.membres')}</th>
                {jours.map((j) => (
                  <th key={j.getTime()} scope="col" className={`eyebrow p-3 text-center ${isoJour(j) === aujourdhui ? 'text-text-primary' : ''}`}>{dateCourte(j)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {actifs.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <th scope="row" className="p-3 text-left font-medium capitalize text-text-primary">{nomCourt(m.email)}</th>
                  {jours.map((j) => {
                    const day = isoJour(j);
                    const k = parCase.get(`${m.email}|${day}`)?.kind ?? null;
                    return (
                      <td key={day} className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => void tourner(m.email, day)}
                          aria-label={`${nomCourt(m.email)} · ${dateCourte(j)} · ${k ? poste(k) : t('planning.kind.vide')}`}
                          className={`min-h-11 w-full rounded-lg border px-2 text-xs transition-colors hover:bg-surface-hover ${k ? teinte[k] : 'border-dashed border-border text-text-muted'}`}
                        >
                          {k ? poste(k) : '·'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-border p-3 text-xs text-text-muted">{t('planning.legende')}</p>
        </motion.div>
      )}
    </motion.section>
  );
}
