import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck, Check, Copy, Link2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Jour = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
interface Fenetre { from: string; to: string }
interface BookingConfigData {
  enabled: boolean;
  title: string;
  intro: string;
  durationMin: number;
  location: string;
  availability: Partial<Record<Jour, Fenetre[]>>;
}
const JOURS: Jour[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DEFAUT: BookingConfigData = {
  enabled: false,
  title: '',
  intro: '',
  durationMin: 30,
  location: '',
  availability: { mon: [{ from: '09:00', to: '12:00' }], tue: [{ from: '09:00', to: '12:00' }], wed: [{ from: '09:00', to: '12:00' }], thu: [{ from: '09:00', to: '12:00' }], fri: [{ from: '09:00', to: '12:00' }] },
};

/**
 * LES RENDEZ-VOUS EN LIGNE — la page publique, réglée d'ici.
 *
 * Pour qui : un salon, une praticienne, une prestataire qui passe ses
 * journées à répondre « quand êtes-vous libre ? ». Ce que ça règle : une
 * adresse à mettre sur le site, dans une bio, un SMS ; les gens choisissent
 * un créneau, et le rendez-vous tombe dans l'Agenda — le même, sur tous ses
 * postes. Calendly fait ça en vendant un abonnement de plus ; ici c'est un
 * réglage, et rien ne sort de l'agenda vers la page sauf les heures prises.
 *
 * Tout ce qui est réglé ici est relu par le serveur à chaque réservation :
 * la page n'est ouverte que si « enabled » l'est, un créneau hors fenêtre
 * est refusé, un créneau pris aussi.
 */
export function BookingScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<Partial<BookingConfigData>>('bookingConfig');
  const rdvs = useCollection<{ source?: string; startAt?: string }>('appointments');
  const [copie, setCopie] = useState(false);

  const config = useMemo<BookingConfigData>(() => {
    const rec = brutes.find((r) => r.id === 'config');
    return { ...DEFAUT, ...(rec ?? {}), availability: { ...DEFAUT.availability, ...(rec?.availability ?? {}) } };
  }, [brutes]);
  const enregistrer = (patch: Partial<BookingConfigData>) => upsert('bookingConfig', 'config', { ...config, ...patch });
  const prisEnLigne = rdvs.filter((r) => r.source === 'booking');
  const aVenir = prisEnLigne.filter((r) => (r.startAt ?? '') >= new Date().toISOString()).length;

  const origine = publicOrigin();
  const adresse = origine && org ? `${origine}/#/rdv?org=${encodeURIComponent(org.id)}` : null;
  const copier = async () => {
    if (!adresse) return;
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : l'adresse reste sélectionnable */
    }
  };
  const jourLibelle = (j: Jour) => t(`rdv.jour.${j}` as Parameters<typeof t>[0]);
  const fenetre = (j: Jour): Fenetre | null => config.availability[j]?.[0] ?? null;
  const reglerJour = (j: Jour, f: Fenetre | null) => enregistrer({ availability: { ...config.availability, [j]: f ? [f] : [] } });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('rdv.titre') })}
          title={t('rdv.titre')}
          description={config.enabled ? t('rdv.ouverte') : t('rdv.fermee')}
          stats={[
            { label: t('rdv.stat.prisEnLigne'), value: prisEnLigne.length },
            { label: t('rdv.stat.aVenir'), value: aVenir, emphasis: aVenir > 0 },
          ]}
          actions={
            <button
              type="button"
              onClick={() => void enregistrer({ enabled: !config.enabled })}
              aria-pressed={config.enabled}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${config.enabled ? 'border border-border-strong text-text-primary hover:bg-surface-hover' : 'bg-accent text-bg hover:bg-accent-hover'}`}
            >
              <CalendarCheck size={16} strokeWidth={2} /> {config.enabled ? t('rdv.fermer') : t('rdv.ouvrir')}
            </button>
          }
        />
      </motion.div>

      <motion.section variants={staggerItem} className="rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow mb-2 flex items-center gap-2"><Link2 size={12} /> {t('rdv.adresse')}</p>
        {adresse ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-bg px-3 py-2 font-mono text-xs text-text-primary">{adresse}</code>
            <button type="button" onClick={() => void copier()} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
              {copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('relances.copie') : t('rdv.copier')}
            </button>
          </div>
        ) : (
          <p className="text-xs leading-relaxed text-text-secondary">{t('rdv.adresseAbsente')}</p>
        )}
        {!config.enabled && <p className="mt-2 text-xs text-text-muted">{t('rdv.adresseFermee')}</p>}
      </motion.section>

      <motion.section variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('rdv.presentation')}</p>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t('rdv.champTitre')}
            <input value={config.title} onChange={(e) => void enregistrer({ title: e.target.value })} placeholder={t('rdv.champTitreExemple')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">
            {t('rdv.champIntro')}
            <textarea value={config.intro} onChange={(e) => void enregistrer({ intro: e.target.value })} rows={3} placeholder={t('rdv.champIntroExemple')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('rdv.champDuree')}
              <select value={config.durationMin} onChange={(e) => void enregistrer({ durationMin: Number(e.target.value) })} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
                {[15, 30, 45, 60, 90].map((n) => <option key={n} value={n}>{t('rdv.minutes', { n })}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">
              {t('rdv.champLieu')}
              <input value={config.location} onChange={(e) => void enregistrer({ location: e.target.value })} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('rdv.disponibilites')}</p>
          <p className="text-xs leading-relaxed text-text-muted">{t('rdv.disponibilitesAide')}</p>
          <ul className="flex flex-col gap-1.5">
            {JOURS.map((j) => {
              const f = fenetre(j);
              return (
                <li key={j} className="flex flex-wrap items-center gap-2">
                  <label className="flex min-h-11 w-28 items-center gap-2 text-sm text-text-primary md:min-h-0">
                    <input type="checkbox" checked={Boolean(f)} onChange={(e) => void reglerJour(j, e.target.checked ? { from: '09:00', to: '12:00' } : null)} className="h-4 w-4" />
                    {jourLibelle(j)}
                  </label>
                  {f && (
                    <>
                      <input type="time" value={f.from} onChange={(e) => void reglerJour(j, { ...f, from: e.target.value })} aria-label={`${jourLibelle(j)} · ${t('rdv.de')}`} className="input-focus min-h-11 border border-border bg-bg px-2 text-sm text-text-primary outline-none md:min-h-0 md:py-1" />
                      <span className="text-xs text-text-muted">→</span>
                      <input type="time" value={f.to} onChange={(e) => void reglerJour(j, { ...f, to: e.target.value })} aria-label={`${jourLibelle(j)} · ${t('rdv.a')}`} className="input-focus min-h-11 border border-border bg-bg px-2 text-sm text-text-primary outline-none md:min-h-0 md:py-1" />
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </motion.section>
    </motion.section>
  );
}
