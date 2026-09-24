import React from 'react';
import { Link } from 'react-router-dom';
import { useLangue } from '../i18n';
import { useHall } from './useHall';

/** Le Hall, dans Paramètres › Extensions : où en est l'organisation, et la porte. Le geste lui-même vit sur l'écran du Hall. */
export function HallSection() {
  const { t } = useLangue();
  const { etat } = useHall();
  const dedans = Boolean(etat?.participation?.participe);
  return (
    <section className="panel p-4" id="reglages-hall">
      <p className="eyebrow mb-2">{t('hall.section.titre')}</p>
      <p className="mb-3 max-w-2xl text-[12px] leading-relaxed text-text-secondary">
        {etat ? (dedans ? t('hall.section.dedans', { nom: etat.participation?.displayName ?? '' }) : t('hall.section.dehors')) : t('hall.sansLien')}
      </p>
      <Link to="/hall" className="inline-flex min-h-11 items-center border border-border-strong px-3 text-[13px] font-semibold text-text-body hover:bg-surface-hover md:min-h-9">
        {t('hall.section.ouvrir')}
      </Link>
    </section>
  );
}
