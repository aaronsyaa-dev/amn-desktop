import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Globe, Link2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { publicOrigin } from '../lib/publicUrl';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

const CONFIG_ID = 'config';
interface MiniSiteConfig {
  enabled: boolean;
  title: string;
  intro: string;
  hours: string;
  address: string;
  phone: string;
  email: string;
  showReviews: boolean;
  showPortfolio: boolean;
}
const DEFAUT: MiniSiteConfig = { enabled: false, title: '', intro: '', hours: '', address: '', phone: '', email: '', showReviews: true, showPortfolio: true };

/**
 * LA MINI-PAGE PUBLIQUE — votre page, composée depuis ce qui existe déjà.
 *
 * Pour qui : une boutique sans site, ou avec un site que personne ne met à
 * jour. Ce que ça règle : une page publique avec la présentation, les
 * horaires, le contact — et, sans rien ressaisir, les avis marqués
 * publiables, le portfolio, la prise de rendez-vous si elle est ouverte.
 * Le serveur ne sert que ce qui a été marqué pour être montré.
 */
export function MiniSiteScreen() {
  const { t } = useLangue();
  const { org } = useAuth();
  const { upsert } = useSync();
  const rows = useCollection<Partial<MiniSiteConfig>>('minisite');
  const avis = useCollection<{ publishable?: boolean }>('reviews');
  const realisations = useCollection<{ visible?: boolean }>('portfolioItems');
  const [copie, setCopie] = useState(false);
  const config: MiniSiteConfig = { ...DEFAUT, ...(rows.find((r) => r.id === CONFIG_ID) ?? {}) };
  const origine = publicOrigin();
  const adresse = origine && org ? `${origine}/#/p?org=${encodeURIComponent(org.id)}` : null;
  const publiables = avis.filter((a) => a.publishable === true).length;
  const visibles = realisations.filter((r) => r.visible !== false).length;

  const enregistrer = (patch: Partial<MiniSiteConfig>) => upsert('minisite', CONFIG_ID, { ...config, ...patch });
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
  const champ = 'input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none';

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('miniPage.titre') })}
          title={t('miniPage.titre')}
          description={config.enabled ? t('miniPage.ouverte') : t('miniPage.fermee')}
          stats={[
            { label: t('miniPage.stat.etat'), value: config.enabled ? t('miniPage.etat.ouverte') : t('miniPage.etat.fermee'), emphasis: config.enabled },
            { label: t('miniPage.stat.avis'), value: publiables },
            { label: t('miniPage.stat.realisations'), value: visibles },
          ]}
          actions={
            <button type="button" onClick={() => void enregistrer({ enabled: !config.enabled })} aria-pressed={config.enabled} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors ${config.enabled ? 'border border-border-strong text-text-primary hover:bg-surface-hover' : 'bg-accent text-bg hover:bg-accent-hover'}`}>
              <Globe size={16} strokeWidth={2} /> {config.enabled ? t('miniPage.fermer') : t('miniPage.ouvrir')}
            </button>
          }
        />
      </motion.div>

      <motion.section variants={staggerItem} aria-label={t('miniPage.adresse')} className="rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow mb-2 flex items-center gap-2"><Link2 size={12} /> {t('miniPage.adresse')}</p>
        {adresse ? (
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all truncate rounded-lg bg-bg px-3 py-2 font-mono text-xs text-text-primary">{adresse}</code>
            <button type="button" onClick={() => void copier()} className="flex min-h-11 items-center gap-1.5 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-2">
              {copie ? <Check size={13} /> : <Copy size={13} />} {copie ? t('miniPage.copie') : t('miniPage.copier')}
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">{t('miniPage.adresseAbsente')}</p>
        )}
        {!config.enabled && adresse && <p className="mt-2 text-xs text-text-muted">{t('miniPage.adresseFermee')}</p>}
      </motion.section>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t('miniPage.section.contenu')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('miniPage.section.contenu')}</p>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champTitre')}<input value={config.title} onChange={(e) => void enregistrer({ title: e.target.value })} placeholder={org?.name ?? ''} className={champ} /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champIntro')}<textarea value={config.intro} onChange={(e) => void enregistrer({ intro: e.target.value })} rows={4} className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champHoraires')}<textarea value={config.hours} onChange={(e) => void enregistrer({ hours: e.target.value })} rows={2} className="input-focus w-full border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champAdresse')}<input value={config.address} onChange={(e) => void enregistrer({ address: e.target.value })} className={champ} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champTelephone')}<input value={config.phone} onChange={(e) => void enregistrer({ phone: e.target.value })} type="tel" className={champ} /></label>
            <label className="flex flex-col gap-1 text-xs text-text-muted">{t('miniPage.champEmail')}<input value={config.email} onChange={(e) => void enregistrer({ email: e.target.value })} type="email" className={champ} /></label>
          </div>
        </section>
        <section aria-label={t('miniPage.section.blocs')} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <p className="eyebrow">{t('miniPage.section.blocs')}</p>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
            <input type="checkbox" checked={config.showReviews} onChange={(e) => void enregistrer({ showReviews: e.target.checked })} className="h-4 w-4" />
            {t('miniPage.montrerAvis')} <span className="tnum text-text-muted">({publiables})</span>
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm text-text-primary">
            <input type="checkbox" checked={config.showPortfolio} onChange={(e) => void enregistrer({ showPortfolio: e.target.checked })} className="h-4 w-4" />
            {t('miniPage.montrerPortfolio')} <span className="tnum text-text-muted">({visibles})</span>
          </label>
          <p className="text-xs leading-relaxed text-text-muted">{t('miniPage.rdv')}</p>
        </section>
      </motion.div>
    </motion.section>
  );
}
